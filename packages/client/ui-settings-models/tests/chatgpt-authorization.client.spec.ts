/** ChatGPT authorization consumes Host events and preserves provider settings during activation. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it, vi } from 'vitest'
import type { AuthorizationEntry, AuthorizationPromptId, AuthorizationRemoteEvent, SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { TestRemote, RemoteError } from '@deepseek-ai/dsh-client-test-runtime'
import { SettingsDescribeMirror } from '@deepseek-ai/dsh-client-ui-settings/src/client/settings-mirror.ts'
import { ChatGptAuthorization } from '../src/client/chatgpt-authorization.ts'
import { ModelsSettingsStore } from '../src/client/store.ts'
import { createModelsOperations } from '../src/client/operations.ts'
import { settingsSchema } from './settings-schema.client.ts'

const KEY = credentialKey('llm-pi-ai', 'openai-codex')
const PROMPT = 'question-one' as AuthorizationPromptId
const NEXT_PROMPT = 'question-two' as AuthorizationPromptId
const FLOW: AuthorizationEntry = { key: KEY, label: 'ChatGPT', methods: [{ id: 'oauth', label: 'ChatGPT' }], inFlight: false }
const ok = <T>(value: T) => ({ ok: true as const, value })
const rejected = () => ({ ok: false as const, error: new RemoteError('gateway/internal', 'private provider response', {}) })

/** A test-owned stream with explicit delivery and cancellation completion. */
class Events {
  private queue: AuthorizationRemoteEvent[] = []
  private wake = Promise.withResolvers<void>()
  private ended = false
  push(event: AuthorizationRemoteEvent): void { this.queue.push(event); this.wake.resolve() }
  end(): void { this.ended = true; this.wake.resolve() }
  async *read(signal: AbortSignal): AsyncGenerator<AuthorizationRemoteEvent> {
    const stop = () => this.end()
    signal.addEventListener('abort', stop, { once: true })
    try {
      while (!this.ended && !signal.aborted) {
        const event = this.queue.shift()
        if (event !== undefined) { yield event; continue }
        const waiting = this.wake.promise
        await waiting
        this.wake = Promise.withResolvers<void>()
      }
    } finally { signal.removeEventListener('abort', stop) }
  }
}

function asObject(value: JsonValue): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('test settings value must be an object')
  return value
}

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

function fixture(value: JsonValue = { providers: { anthropic: { models: [{ id: 'keep-me' }] } } }) {
  const ctx = new Context()
  const events = new Events()
  let namespace: SettingsNamespaceView = {
    ns: 'llm-pi-ai', schema: {}, value, user: value, revision: 7, autoGenerate: true, applies: 'live', secrets: [],
  }
  let writable = true
  let configured = false
  let inFlight = false
  let flows: readonly AuthorizationEntry[] = [FLOW]
  let refuseWrite = false
  let failReadAfterWrite = false
  let providerReadFailed = false
  const list = vi.fn(async () => ok(flows))
  const status = vi.fn(async () => ok({ key: KEY, configured, writable, inFlight }))
  const begin = vi.fn((_key: string, _method: string, signal: AbortSignal) => events.read(signal))
  const answer = vi.fn(async (_key: string, _id: AuthorizationPromptId, _value: string) => ok(undefined))
  const mutate = vi.fn(async (_ns: string, ops: SettingsPathOpView[], _revision: number | undefined) => {
    if (refuseWrite) return rejected()
    let next = asObject(namespace.value)
    for (const op of ops) next = op.op === 'set'
      ? settingsSchema.setPath(next, op.path, op.value) : settingsSchema.deletePath(next, op.path)
    const serialized = JSON.stringify(next)
    if (serialized === undefined) throw new Error('test settings value must be JSON-serializable')
    const value: JsonValue = JSON.parse(serialized) as JsonValue
    namespace = { ...namespace, value, user: value, revision: namespace.revision + 1 }
    if (failReadAfterWrite) providerReadFailed = true
    return ok(namespace)
  })
  new TestRemote(ctx, {
    authorization: { list, status, begin, answer },
    settings: { describe: async () => ok({ writable, hasDocument: true, namespaces: [namespace] }), mutate },
    credentials: { describe: async () => ok({}) },
    llm: {
      listProviders: async () => providerReadFailed ? rejected() : ok(
        settingsSchema.getPath(namespace.value, ['providers', 'openai-codex']) === undefined
          ? [] : [{ id: 'openai-codex', name: 'Codex' }]),
      listConfigurableProviders: async () => ok([{ provider: 'openai-codex', displayName: 'Codex', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'openai-codex'] }]),
    },
  })
  const mirror = new SettingsDescribeMirror(ctx)
  const models = new ModelsSettingsStore(ctx, settingsSchema, mirror)
  const controller = new ChatGptAuthorization(ctx, models, createModelsOperations(ctx), settingsSchema)
  cleanups.push(async () => { events.end(); await controller.dispose(); await ctx.fiber.dispose() })
  return {
    controller, events, list, status, begin, answer, mutate, models,
    snapshot: () => controller.store.getSnapshot(), namespace: () => namespace,
    setWritable: (next: boolean) => { writable = next },
    setConfigured: (next: boolean) => { configured = next },
    setInFlight: (next: boolean) => { inFlight = next },
    setFlows: (next: readonly AuthorizationEntry[]) => { flows = next },
    refuseWrite: (next = true) => { refuseWrite = next },
    failReadAfterWrite: () => { failReadAfterWrite = true },
  }
}

it('loads only the Codex OAuth flow and redacted credential status, including busy/read-only state', async () => {
  const f = fixture()
  f.setConfigured(true)
  f.setInFlight(true)
  await f.controller.load()
  expect(f.status).toHaveBeenCalledWith(KEY)
  expect(f.snapshot()).toMatchObject({ availability: 'available', configured: true, writable: false })
  f.setInFlight(false)
  f.setWritable(false)
  await f.controller.load()
  expect(f.snapshot().writable).toBe(false)
  f.setFlows([{ ...FLOW, methods: [{ id: 'api-key', label: 'Key' }] }])
  await f.controller.load()
  expect(f.snapshot().availability).toBe('unavailable')
})

it('relays select and manual prompts, retains device URL/code across progress, and ignores withdrawn answers', async () => {
  const f = fixture()
  await f.controller.load()
  const running = f.controller.start()
  expect(f.controller.start()).toBe(running)
  expect(f.begin).toHaveBeenCalledOnce()
  f.events.push({ type: 'notice', notice: { message: 'Visit the page', url: 'https://auth.openai.com/codex/device', code: 'ABCD-EFGH' } })
  f.events.push({ type: 'notice', notice: { message: 'Waiting for approval' } })
  f.events.push({ type: 'prompt', id: PROMPT, prompt: { kind: 'select', message: 'Choose', options: [{ id: 'browser', label: 'Browser' }] } })
  await vi.waitFor(() => expect(f.snapshot().prompt?.id).toBe(PROMPT))
  expect(f.snapshot().notice).toEqual({ message: 'Waiting for approval', url: 'https://auth.openai.com/codex/device', code: 'ABCD-EFGH' })
  await f.controller.answer(PROMPT, 'browser')
  expect(f.answer).toHaveBeenCalledWith(KEY, PROMPT, 'browser')
  expect(f.snapshot().prompt).toBeUndefined()
  f.events.push({ type: 'prompt', id: NEXT_PROMPT, prompt: { kind: 'text', message: 'Paste redirect' } })
  f.events.push({ type: 'prompt-withdrawn', id: PROMPT })
  await vi.waitFor(() => expect(f.snapshot().prompt?.id).toBe(NEXT_PROMPT))
  f.events.push({ type: 'prompt-withdrawn', id: NEXT_PROMPT })
  await vi.waitFor(() => expect(f.snapshot().prompt).toBeUndefined())
  await f.controller.answer(NEXT_PROMPT, 'must not send')
  expect(f.answer).toHaveBeenCalledOnce()
  f.events.push({ type: 'settled', status: 'cancelled' })
  await vi.waitFor(() => expect(f.snapshot().phase).toBe('idle'))
  f.events.end()
  await running
  expect(f.snapshot().failure).toBeUndefined()
  expect(f.mutate).not.toHaveBeenCalled()
})

it('cancels only its stream and refreshes presence after cancellation', async () => {
  const f = fixture()
  await f.controller.load()
  const running = f.controller.start()
  const signal = f.begin.mock.calls[0]![2]
  f.events.push({ type: 'prompt', id: PROMPT, prompt: { kind: 'secret', message: 'Sensitive answer' } })
  await vi.waitFor(() => expect(f.snapshot().prompt).toBeDefined())
  await f.controller.cancel()
  await running
  expect(signal.aborted).toBe(true)
  expect(f.status).toHaveBeenCalledTimes(2)
  expect(f.snapshot()).toMatchObject({ phase: 'idle', failure: undefined, prompt: undefined, notice: undefined })
})

it('keeps ChatGPT sign-in separate from Codex activation until explicitly enabled', async () => {
  const f = fixture()
  await f.controller.load()
  const running = f.controller.start()
  f.events.push({ type: 'settled', status: 'authorized' })
  await vi.waitFor(() => expect(f.snapshot().configured).toBe(true))
  f.events.end()
  await running
  expect(f.mutate).not.toHaveBeenCalled()
  expect(f.snapshot()).toMatchObject({ configured: true, enabled: false, phase: 'idle' })

  await f.controller.enable()
  expect(f.mutate).toHaveBeenCalledWith('llm-pi-ai', [{ op: 'set', path: ['providers', 'openai-codex'], value: {} }], 7)
  expect(f.namespace().value).toEqual({ providers: { anthropic: { models: [{ id: 'keep-me' }] }, 'openai-codex': {} } })
  expect(f.snapshot()).toMatchObject({ configured: true, enabled: true, phase: 'idle' })
})

it('removes only an existing key override and preserves Codex models, endpoint, and other providers', async () => {
  const value = { providers: { 'openai-codex': { apiKeyEnv: 'OLD_KEY', baseURL: 'https://example.test', models: [{ id: 'chosen' }] }, anthropic: { reasoning: 'high' } } }
  const f = fixture(value)
  await f.controller.enable()
  expect(f.mutate).toHaveBeenCalledWith('llm-pi-ai', [{ op: 'unset', path: ['providers', 'openai-codex', 'apiKeyEnv'] }], 7)
  expect(f.namespace().value).toEqual({ providers: { 'openai-codex': { baseURL: 'https://example.test', models: [{ id: 'chosen' }] }, anthropic: { reasoning: 'high' } } })
  expect(value.providers['openai-codex'].apiKeyEnv).toBe('OLD_KEY')
})

it('keeps a committed grant when explicit Codex activation is refused and retries without another login', async () => {
  const f = fixture()
  f.setConfigured(true)
  f.refuseWrite()
  await f.controller.load()
  await f.controller.enable()
  expect(f.snapshot()).toMatchObject({ configured: true, enabled: false, failure: 'enable', phase: 'idle' })
  f.refuseWrite(false)
  await f.controller.enable()
  expect(f.begin).not.toHaveBeenCalled()
  expect(f.mutate).toHaveBeenCalledTimes(2)
  expect(f.snapshot()).toMatchObject({ configured: true, enabled: true, failure: undefined })
  expect(JSON.stringify(f.snapshot())).not.toContain('private provider response')
})

it('retains the grant but does not claim readiness when the post-write provider refresh fails', async () => {
  const f = fixture()
  f.failReadAfterWrite()
  f.setConfigured(true)
  await f.controller.load()
  await f.controller.enable()
  expect(f.mutate).toHaveBeenCalledOnce()
  expect(f.snapshot()).toMatchObject({ configured: true, enabled: false, failure: 'enable', phase: 'idle' })
  expect(f.begin).not.toHaveBeenCalled()
})

it('does not write an already-native route, including read-only settings', async () => {
  const f = fixture({ providers: { 'openai-codex': { models: [{ id: 'keep' }] } } })
  f.setWritable(false)
  await f.controller.enable()
  expect(f.snapshot().enabled).toBe(true)
  expect(f.mutate).not.toHaveBeenCalled()
})

it('shows the Host diagnostic category without retaining provider messages or stream secrets', async () => {
  const f = fixture()
  f.list.mockRejectedValueOnce(new Error('access-token=never-display'))
  await f.controller.load()
  expect(f.snapshot()).toMatchObject({ availability: 'failed', failure: 'load' })
  await f.controller.load()
  expect(f.snapshot().failure).toBeUndefined()
  f.begin.mockImplementationOnce(() => (async function* () {
    throw new RemoteError('authorization/rejected', 'private provider response', {
      code: 'FLOW_FAILED', diagnostic: 'DNS_LOOKUP',
    })
  })())
  await f.controller.start()
  expect(f.snapshot()).toMatchObject({ failure: 'login', diagnostic: 'DNS_LOOKUP' })
  f.events.end()
  await f.controller.start()
  expect(f.snapshot()).toMatchObject({ failure: 'login', diagnostic: 'UNKNOWN' })
  expect(JSON.stringify(f.snapshot())).not.toContain('private provider response')
})

it('ignores an answer rejection after the callback withdrew its prompt', async () => {
  const f = fixture()
  const response = Promise.withResolvers<ReturnType<typeof ok<undefined>>>()
  f.answer.mockImplementationOnce(() => response.promise)
  await f.controller.load()
  const running = f.controller.start()
  f.events.push({ type: 'prompt', id: PROMPT, prompt: { kind: 'text', message: 'Paste redirect' } })
  await vi.waitFor(() => expect(f.snapshot().prompt).toBeDefined())
  const answering = f.controller.answer(PROMPT, 'private-code')
  f.events.push({ type: 'prompt-withdrawn', id: PROMPT })
  await vi.waitFor(() => expect(f.snapshot().prompt).toBeUndefined())
  response.reject(new Error('private-code'))
  await answering
  expect(f.snapshot().failure).toBeUndefined()
  await f.controller.cancel()
  await running
})

it('keeps the replacement question when an earlier answer succeeds late', async () => {
  const f = fixture()
  const response = Promise.withResolvers<ReturnType<typeof ok<undefined>>>()
  f.answer.mockImplementationOnce(() => response.promise)
  await f.controller.load()
  const running = f.controller.start()
  f.events.push({ type: 'prompt', id: PROMPT, prompt: { kind: 'select', message: 'Method', options: [{ id: 'browser', label: 'Browser' }] } })
  await vi.waitFor(() => expect(f.snapshot().prompt?.id).toBe(PROMPT))
  const answering = f.controller.answer(PROMPT, 'browser')
  f.events.push({ type: 'prompt', id: NEXT_PROMPT, prompt: { kind: 'text', message: 'Paste redirect' } })
  await vi.waitFor(() => expect(f.snapshot().prompt?.id).toBe(NEXT_PROMPT))
  response.resolve(ok(undefined))
  await answering
  expect(f.snapshot().prompt).toEqual({ id: NEXT_PROMPT, question: { kind: 'text', message: 'Paste redirect' } })
  expect(f.snapshot().failure).toBeUndefined()
  await f.controller.cancel()
  await running
})

it('ignores late credential reads after disposal', async () => {
  const f = fixture()
  const response = Promise.withResolvers<ReturnType<typeof ok<readonly AuthorizationEntry[]>>>()
  f.list.mockImplementationOnce(() => response.promise)
  const loading = f.controller.load()
  await f.controller.dispose()
  response.resolve(ok([FLOW]))
  await loading
  expect(f.status).not.toHaveBeenCalled()
  await f.controller.start()
  expect(f.begin).not.toHaveBeenCalled()
})
