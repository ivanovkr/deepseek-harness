/** Remote conversation owner for registered authorization flows; credentials never leave the store. */
import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials'
import { Remote, RemoteError, TypertRemoteService, type PeerId } from '@deepseek-ai/dsh-typert-protocol'
import { AuthorizationError, type AuthorizationPrompt } from './index.ts'
import type { AuthorizationEntry } from './types.ts'
import type {
  AuthorizationPromptId, AuthorizationRemoteDiagnostic, AuthorizationRemoteEvent, AuthorizationRemoteFailureCode, AuthorizationRemotePrompt, AuthorizationRemoteStatus,
} from './remote-types.ts'

interface PendingPrompt {
  readonly resolve: (value: string) => void
  readonly reject: (error: unknown) => void
  readonly prompt: AuthorizationRemotePrompt
  readonly cleanup: () => void
}

interface Attempt {
  readonly controller: AbortController
  readonly peer: PeerId | undefined
  readonly prompts: Map<AuthorizationPromptId, PendingPrompt>
  readonly done: Promise<void>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Remote conversation owner, separate from the in-process flow registry. */
    authorizationRemote: AuthorizationRemote
  }
}

/** Host owner of the authorization Remote namespace. */
export class AuthorizationRemote extends TypertRemoteService {
  static inject = ['authorization', 'credentials']
  private readonly attempts = new Map<CredentialKey, Attempt>()

  /** @param ctx - context owning the registry and credential store. */
  constructor(ctx: Context) {
    super(ctx, 'authorizationRemote', { namespace: 'authorization' })
    ctx.effect(() => async () => {
      const attempts = [...this.attempts.values()]
      for (const attempt of attempts) attempt.controller.abort()
      await Promise.all(attempts.map(attempt => attempt.done))
    })
  }

  /** @returns registered flows in registration order, without stored credentials. */
  @Remote
  list(): AuthorizationEntry[] {
    return this.ctx.authorization.list().map(entry => ({
      key: entry.key,
      label: entry.label,
      methods: entry.methods.map(method => ({ id: method.id, label: method.label })),
      inFlight: entry.inFlight,
    }))
  }

  /**
   * Read credential availability for a registered flow.
   * @param key - registered credential record key.
   * @returns configuration and write availability, never the grant or a masked token.
   */
  @Remote
  async status(key: CredentialKey): Promise<AuthorizationRemoteStatus> {
    this.requireFlow(key)
    const info = await this.ctx.credentials.describeRecord(key)
    return { key, configured: info.configured, writable: info.writable,
      inFlight: this.ctx.authorization.describe(key)?.inFlight === true }
  }

  /**
   * Run a flow with notices and questions delivered only to this stream.
   * @param key - registered credential key.
   * @param method - declared method; undefined chooses the flow's first method.
   * @param signal - stream lifetime; withdrawal cancels only the attempt it started.
   * @returns ordered notices, prompts, prompt withdrawals, and terminal settlement; failures reject with redacted codes.
   */
  @Remote({ mode: 'stream' })
  async *begin(
    key: CredentialKey, method: string | undefined, signal: AbortSignal,
  ): AsyncIterable<AuthorizationRemoteEvent> {
    this.requireFlow(key)
    if (this.attempts.has(key)) throw refusal('ALREADY_IN_FLIGHT')
    const controller = new AbortController()
    const withdraw = (): void => { controller.abort() }
    const queue: AuthorizationRemoteEvent[] = []
    let wake: (() => void) | undefined
    let finished = false
    let failure: unknown
    const publish = (event: AuthorizationRemoteEvent): void => {
      if (finished || controller.signal.aborted) return
      queue.push(event)
      wake?.()
    }
    const prompts = new Map<AuthorizationPromptId, PendingPrompt>()
    const rejectPrompts = (): void => {
      for (const pending of prompts.values()) {
        pending.cleanup()
        pending.reject(new AuthorizationError('authorization prompt withdrawn', 'CANCELLED'))
      }
      prompts.clear()
    }
    controller.signal.addEventListener('abort', rejectPrompts, { once: true })
    signal.addEventListener('abort', withdraw, { once: true })
    if (signal.aborted) controller.abort()
    let finish!: () => void
    const done = new Promise<void>((resolve) => { finish = resolve })
    const attempt: Attempt = { controller, peer: this.ctx.invocation?.peer.id, prompts, done }
    this.attempts.set(key, attempt)
    const running = this.ctx.authorization.begin({
      key, ...method === undefined ? {} : { method }, signal: controller.signal,
      interaction: {
        notify: notice => publish({ type: 'notice', notice: {
          message: notice.message,
          ...notice.url === undefined ? {} : { url: notice.url },
          ...notice.code === undefined ? {} : { code: notice.code },
        } }),
        prompt: prompt => this.ask(prompt, attempt, publish),
      },
    }).then(outcome => { queue.push({ type: 'settled', status: outcome.status }) }, (error: unknown) => {
      const code = error instanceof AuthorizationError ? error.code : undefined
      switch (code) {
        case 'NO_FLOW': case 'UNKNOWN_METHOD': case 'ALREADY_IN_FLIGHT': case 'NOT_COMMITTED':
          failure = refusal(code)
          break
        default:
          failure = refusal('FLOW_FAILED', diagnosticOf(error))
      }
    }).finally(() => {
      finished = true
      rejectPrompts()
      if (this.attempts.get(key) === attempt) this.attempts.delete(key)
      wake?.()
      finish()
    })
    try {
      while (true) {
        if (queue.length > 0) { yield queue.shift()!; continue }
        if (finished) {
          if (failure !== undefined) throw failure
          return
        }
        await new Promise<void>((resolve) => { wake = resolve })
      }
    } finally {
      controller.abort()
      signal.removeEventListener('abort', withdraw)
      controller.signal.removeEventListener('abort', rejectPrompts)
      await running
    }
  }

  /**
   * Answer a question from this peer's running stream; answers are neither retained nor logged.
   * @param key - credential key of the attempt.
   * @param id - opaque identity emitted with the prompt.
   * @param value - typed text or offered select option id.
   */
  @Remote
  answer(key: CredentialKey, id: AuthorizationPromptId, value: string): void {
    const attempt = this.ownedAttempt(key)
    const pending = attempt.prompts.get(id)
    if (pending === undefined) throw refusal('STALE_PROMPT')
    if (pending.prompt.kind === 'select' && !pending.prompt.options.some(option => option.id === value)) {
      throw refusal('INVALID_ANSWER')
    }
    attempt.prompts.delete(id)
    pending.cleanup()
    pending.resolve(value)
  }

  /**
   * Cancel this peer's running stream; already admitted commits finish before the stream settles.
   * @param key - credential key of the attempt; no attempt is a no-op.
   */
  @Remote
  cancel(key: CredentialKey): void {
    if (!this.attempts.has(key)) return
    const attempt = this.ownedAttempt(key)
    attempt.controller.abort()
  }

  private requireFlow(key: CredentialKey): void {
    if (this.ctx.authorization.describe(key) === undefined) throw refusal('NO_FLOW')
  }

  private ownedAttempt(key: CredentialKey): Attempt {
    const attempt = this.attempts.get(key)
    if (attempt === undefined) throw refusal('NO_ATTEMPT')
    if (attempt.peer !== this.ctx.invocation?.peer.id) throw refusal('NOT_OWNER')
    return attempt
  }

  private ask(
    prompt: AuthorizationPrompt, attempt: Attempt, publish: (event: AuthorizationRemoteEvent) => void,
  ): Promise<string> {
    if (attempt.controller.signal.aborted || prompt.signal?.aborted === true) {
      return Promise.reject(new AuthorizationError('authorization prompt withdrawn', 'CANCELLED'))
    }
    const id = randomUUID() as AuthorizationPromptId
    const wire: AuthorizationRemotePrompt = prompt.kind === 'select'
      ? { kind: prompt.kind, message: prompt.message, options: prompt.options.map(option => ({
        id: option.id, label: option.label,
        ...option.description === undefined ? {} : { description: option.description },
      })) }
      : { kind: prompt.kind, message: prompt.message,
        ...prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder } }
    return new Promise<string>((resolve, reject) => {
      const withdraw = (): void => {
        if (!attempt.prompts.delete(id)) return
        publish({ type: 'prompt-withdrawn', id })
        reject(new AuthorizationError('authorization prompt withdrawn', 'CANCELLED'))
      }
      const cleanup = (): void => { prompt.signal?.removeEventListener('abort', withdraw) }
      attempt.prompts.set(id, { resolve, reject, prompt: wire, cleanup })
      prompt.signal?.addEventListener('abort', withdraw, { once: true })
      publish({ type: 'prompt', id, prompt: wire })
    })
  }
}

/** Redact provider messages, causes, and answers at the wire error boundary. */
function refusal(code: AuthorizationRemoteFailureCode, diagnostic?: AuthorizationRemoteDiagnostic): RemoteError {
  return new RemoteError('authorization/rejected', `Authorization could not complete (${code}).`, {
    code, ...diagnostic === undefined ? {} : { diagnostic },
  })
}

/** Reduce an OAuth failure to a transport category; never send provider text or URLs to the Client. */
function diagnosticOf(error: unknown): AuthorizationRemoteDiagnostic {
  const pending: unknown[] = [error]
  const visited = new Set<object>()
  let networkFailure = false
  while (pending.length > 0 && visited.size < 8) {
    const candidate = pending.shift()
    if (typeof candidate !== 'object' || candidate === null || visited.has(candidate)) continue
    visited.add(candidate)
    const value = candidate as { code?: unknown; cause?: unknown; status?: unknown; errors?: unknown }
    const code = typeof value.code === 'string' ? value.code.toUpperCase() : ''
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS_LOOKUP'
    if (code === 'ECONNREFUSED') return 'CONNECTION_REFUSED'
    if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_HEADERS_TIMEOUT') return 'NETWORK_TIMEOUT'
    if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') return 'CONNECTION_RESET'
    if (code.startsWith('CERT_') || code.startsWith('ERR_TLS_') || code.startsWith('UNABLE_TO_VERIFY_')) return 'TLS_FAILURE'
    if (typeof value.status === 'number') {
      if (value.status === 401) return 'HTTP_UNAUTHORIZED'
      if (value.status === 403) return 'HTTP_FORBIDDEN'
      if (value.status === 429) return 'HTTP_RATE_LIMITED'
      if (value.status >= 500 && value.status <= 599) return 'HTTP_SERVER_ERROR'
      if (value.status >= 400 && value.status <= 499) return 'HTTP_ERROR'
    }
    if (candidate instanceof TypeError && candidate.message === 'fetch failed') networkFailure = true
    if (value.cause !== undefined) pending.push(value.cause)
    if (Array.isArray(value.errors)) pending.push(...value.errors)
  }
  return networkFailure ? 'NETWORK_ERROR' : 'UNKNOWN'
}

export default AuthorizationRemote
