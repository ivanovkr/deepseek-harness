/** ChatGPT sign-in interaction and redacted Host state for the Models page. */
import type { Context } from '@deepseek-ai/cordis'
import type {
  AuthorizationEntry, AuthorizationNotice, AuthorizationPromptId, AuthorizationRemoteDiagnostic, AuthorizationRemotePrompt,
} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelsOperations } from './operations.ts'
import type { ModelsSettingsStore } from './store.ts'
import type { SettingsSchemaOperations } from './schema-operations.ts'

/** Renderable sign-in state; credentials and submitted answers are never retained. */
export interface ChatGptAuthorizationState {
  availability: 'idle' | 'loading' | 'available' | 'unavailable' | 'failed'
  configured: boolean
  writable: boolean
  phase: 'idle' | 'signing-in' | 'enabling'
  enabled: boolean
  notice: AuthorizationNotice | undefined
  prompt: { id: AuthorizationPromptId; question: AuthorizationRemotePrompt } | undefined
  failure: 'load' | 'login' | 'answer' | 'enable' | undefined
  diagnostic: AuthorizationRemoteDiagnostic | undefined
}

/** Owns one non-reconnecting authorization stream and its pending questions. */
export class ChatGptAuthorization {
  readonly store = createSnapshotStore<ChatGptAuthorizationState>({
    availability: 'idle', configured: false, writable: false, phase: 'idle', enabled: false,
    notice: undefined, prompt: undefined, failure: undefined, diagnostic: undefined,
  })
  private entry: AuthorizationEntry | undefined
  private attempt: { abort: AbortController; done: Promise<void> } | undefined
  private revision = 0
  private disposed = false

  /** @param ctx - plugin-owned Remote methods. @param models - provider/settings projection. @param operations - settings mutations. @param schema - settings path reads. */
  constructor(
    private readonly ctx: Context,
    private readonly models: ModelsSettingsStore,
    private readonly operations: ModelsOperations,
    private readonly schema: SettingsSchemaOperations,
  ) {}

  /** Refresh credential presence without reading a grant. @returns completion of the latest redacted query. */
  async load(): Promise<void> {
    const revision = ++this.revision
    this.store.update(s => { s.availability = 'loading' })
    try {
      const listed = await this.ctx.remote.authorization.list()
      if (revision !== this.revision || this.disposed) return
      if (!listed.ok) { this.loadFailed(); return }
      const entry = listed.value.find(item => item.key === 'llm-pi-ai/openai-codex' && item.methods.some(method => method.id === 'oauth'))
      this.entry = entry
      if (entry === undefined) {
        this.store.update(s => { s.availability = 'unavailable' })
        return
      }
      const status = await this.ctx.remote.authorization.status(entry.key)
      if (revision !== this.revision || this.disposed) return
      if (!status.ok) { this.loadFailed(); return }
      const enabled = this.models.store.getSnapshot().rows.some(row => row.entry.provider === 'openai-codex' && row.configured && row.apiKeyEnv === undefined)
      this.store.update(s => {
        s.availability = 'available'
        s.configured = status.value.configured
        s.writable = status.value.writable && !status.value.inFlight
        s.enabled = enabled
        if (s.failure === 'load') s.failure = undefined
      })
    } catch (_error) {
      // Transport errors may carry provider URLs; only localized recovery guidance reaches the page.
      if (revision === this.revision && !this.disposed) this.loadFailed()
    }
  }

  /** Start OAuth once; repeated clicks join the current attempt. @returns completion including provider activation. */
  start(): Promise<void> {
    if (this.attempt !== undefined) return this.attempt.done
    const entry = this.entry
    if (entry === undefined || this.disposed) return Promise.resolve()
    const abort = new AbortController()
    const attempt = { abort, done: Promise.resolve() }
    this.attempt = attempt
    this.store.update(s => { s.phase = 'signing-in'; s.failure = undefined; s.diagnostic = undefined; s.notice = undefined; s.prompt = undefined })
    attempt.done = this.run(entry, abort).finally(() => {
      if (this.attempt === attempt) this.attempt = undefined
    })
    return attempt.done
  }

  /** Submit only the currently displayed question. @param id - opaque question identity. @param value - answer sent directly to the Host, never stored. @returns completion of the answer request. */
  async answer(id: AuthorizationPromptId, value: string): Promise<void> {
    const entry = this.entry
    if (entry === undefined || this.store.getSnapshot().prompt?.id !== id) return
    try {
      const result = await this.ctx.remote.authorization.answer(entry.key, id, value)
      if (this.disposed || this.store.getSnapshot().prompt?.id !== id) return
      this.store.update(s => { if (result.ok) s.prompt = undefined; else s.failure = 'answer' })
    } catch (_error) {
      // A callback can withdraw a manual question while its answer is in flight.
      if (!this.disposed && this.store.getSnapshot().prompt?.id === id) this.store.update(s => { s.failure = 'answer' })
    }
  }

  /** Cancel this caller's stream; no other browser's attempt is affected. @returns cancellation and redacted-state refresh. */
  async cancel(): Promise<void> {
    const attempt = this.attempt
    if (attempt === undefined) return
    attempt.abort.abort()
    await attempt.done
    if (!this.disposed) await this.load()
  }

  /** Enable the native OAuth route, preserving unrelated provider settings. @returns completion; a failed settings write leaves the grant stored. */
  async enable(): Promise<void> {
    if (this.disposed) return
    this.store.update(s => { s.phase = 'enabling'; s.failure = undefined })
    try {
      await this.models.load()
      if (this.disposed) return
      const page = this.models.store.getSnapshot()
      const namespace = page.namespaces.get('llm-pi-ai')
      const path = ['providers', 'openai-codex']
      if (page.status !== 'ready' || namespace === undefined) { this.enableFailed(); return }
      const exists = this.schema.getPath(namespace.value, path) !== undefined
      const override = this.schema.getPath(namespace.value, [...path, 'apiKeyEnv']) !== undefined
      if (!exists || override) {
        if (!page.writable) { this.enableFailed(); return }
        const result = await this.operations.writeSettings('llm-pi-ai', exists
          ? [{ op: 'unset', path: [...path, 'apiKeyEnv'] }]
          : [{ op: 'set', path, value: {} }], namespace.revision)
        if (this.disposed) return
        if (result.kind !== 'written') { this.enableFailed(); return }
        this.models.acceptSettingsView(result.view)
        await this.models.load()
      }
      if (this.disposed) return
      const refreshed = this.models.store.getSnapshot()
      const route = refreshed.rows.find(row => row.entry.provider === 'openai-codex')
      if (refreshed.status !== 'ready' || route?.configured !== true || !route.entry.active || route.apiKeyEnv !== undefined) {
        this.enableFailed()
        return
      }
      this.store.update(s => { s.phase = 'idle'; s.enabled = true })
    } catch (_error) {
      // The grant has already committed; a settings/transport failure must not invite another OAuth exchange.
      if (!this.disposed) this.enableFailed()
    }
  }

  /** Stop the owned stream and ignore late reads. @returns completion of the owned attempt. */
  async dispose(): Promise<void> {
    this.disposed = true
    this.revision++
    this.attempt?.abort.abort()
    await this.attempt?.done
  }

  private async run(entry: AuthorizationEntry, abort: AbortController): Promise<void> {
    let settled = false
    try {
      const stream = this.ctx.remote.authorization.begin(entry.key, 'oauth', abort.signal)
      for await (const event of stream) {
        if (this.disposed || abort.signal.aborted) break
        switch (event.type) {
          case 'notice':
            this.store.update(s => { s.notice = { ...s.notice, ...event.notice } })
            break
          case 'prompt':
            this.store.update(s => { s.prompt = { id: event.id, question: event.prompt }; s.failure = undefined })
            break
          case 'prompt-withdrawn':
            this.store.update(s => { if (s.prompt?.id === event.id) s.prompt = undefined })
            break
          case 'settled':
            settled = true
            this.store.update(s => { s.prompt = undefined; s.notice = undefined; s.phase = 'idle' })
            if (event.status === 'authorized') this.store.update(s => { s.configured = true; s.diagnostic = undefined })
            break
        }
      }
      if (!settled && !abort.signal.aborted && !this.disposed) this.store.update(s => { s.failure = 'login'; s.diagnostic = 'UNKNOWN' })
    } catch (error: unknown) {
      // Only the Host's allowlisted diagnostic category crosses this boundary; provider text can contain secrets.
      if (!abort.signal.aborted && !this.disposed) this.store.update(s => {
        s.failure = 'login'
        s.diagnostic = diagnosticFrom(error)
      })
    } finally {
      if (!this.disposed) this.store.update(s => { s.phase = 'idle'; s.prompt = undefined; s.notice = undefined })
    }
  }

  private loadFailed(): void {
    this.store.update(s => { s.availability = 'failed'; s.failure = 'load' })
  }

  private enableFailed(): void {
    this.store.update(s => { s.phase = 'idle'; s.failure = 'enable'; s.enabled = false })
  }
}

const AUTHORIZATION_DIAGNOSTICS: readonly AuthorizationRemoteDiagnostic[] = [
  'DNS_LOOKUP', 'CONNECTION_REFUSED', 'NETWORK_TIMEOUT', 'CONNECTION_RESET', 'TLS_FAILURE',
  'HTTP_UNAUTHORIZED', 'HTTP_FORBIDDEN', 'HTTP_RATE_LIMITED', 'HTTP_SERVER_ERROR', 'HTTP_ERROR',
  'NETWORK_ERROR', 'UNKNOWN',
]

/** Accept only the category the Host explicitly allowlists; discard all remote error text. */
function diagnosticFrom(error: unknown): AuthorizationRemoteDiagnostic | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const details = (error as { details?: unknown }).details
  if (typeof details !== 'object' || details === null) return undefined
  const result = details as { code?: unknown; diagnostic?: unknown }
  if (result.code !== 'FLOW_FAILED' || typeof result.diagnostic !== 'string') return undefined
  return AUTHORIZATION_DIAGNOSTICS.includes(result.diagnostic as AuthorizationRemoteDiagnostic)
    ? result.diagnostic as AuthorizationRemoteDiagnostic
    : undefined
}
