/** Request-local network causes survive the SDK's generic connection-error envelope. */
import { expect, it, onTestFinished, vi } from 'vitest'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '../src/adapter.ts'
import { resolveProfiles } from '../src/config.ts'
import { memoryAuth } from './auth-double.ts'

function adapter(api: 'openai-completions' | 'openai-responses' = 'openai-completions'): PiAiAdapter {
  return new PiAiAdapter({
    profiles: () => resolveProfiles({
      gateway: { api, baseURL: 'https://diagnostic.invalid/v1', models: [{ id: 'model', contextWindow: 8192, maxTokens: 1024 }] },
    }),
    resolveApiKey: async () => 'test-key',
    auth: memoryAuth(),
  })
}

async function collect(subject: PiAiAdapter): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of subject.stream({ provider: 'gateway', model: 'model', messages: [] })) chunks.push(chunk)
  return chunks
}

function rejectFetch(error: unknown) {
  const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(error)
  onTestFinished(() => { spy.mockRestore() })
  return spy
}

it.each(['openai-completions', 'openai-responses'] as const)('preserves TLS codes on %s without exposing exception messages', async (api) => {
  const cause = Object.assign(new Error('https://user:private-password@proxy.invalid secret-token'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' })
  const fetch = rejectFetch(new TypeError('fetch failed', { cause }))
  const chunks = await collect(adapter(api))
  expect(fetch).toHaveBeenCalledOnce()
  expect(chunks.at(-1)).toMatchObject({
    type: 'finish', reason: { kind: 'error', failure: {
      code: 'TRANSPORT', message: 'Connection error. (SELF_SIGNED_CERT_IN_CHAIN)',
    } },
  })
  expect(JSON.stringify(chunks)).not.toContain('private-password')
  expect(JSON.stringify(chunks)).not.toContain('secret-token')
})

it.each(['ECONNREFUSED', 'ERR_INVALID_ARG_VALUE'])('finds %s inside aggregate causes', async (code) => {
  rejectFetch(new TypeError('fetch failed', { cause: new AggregateError([
    Object.assign(new Error('private endpoint'), { code }),
  ]) }))
  expect((await collect(adapter())).at(-1)).toMatchObject({
    type: 'finish', reason: { failure: { message: `Connection error. (${code})` } },
  })
})

it('does not publish unknown codes or loop over cyclic causes', async () => {
  const error = Object.assign(new Error('secret'), { code: 'PRIVATE_TOKEN', cause: undefined as Error | undefined })
  error.cause = error
  rejectFetch(error)
  const chunks = await collect(adapter())
  expect(chunks.at(-1)).toMatchObject({
    type: 'finish', reason: { failure: { message: 'Connection error.' } },
  })
  expect(JSON.stringify(chunks)).not.toContain('PRIVATE_TOKEN')
})

it('keeps concurrent request diagnostics separate', async () => {
  const waiting = Promise.withResolvers<undefined>()
  const first = Object.assign(new Error('TLS'), { code: 'CERT_HAS_EXPIRED' })
  const second = Object.assign(new Error('network'), { code: 'ECONNRESET' })
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(async () => { await waiting.promise; throw first })
    .mockImplementationOnce(async () => { waiting.resolve(undefined); throw second })
  onTestFinished(() => { waiting.resolve(undefined); fetch.mockRestore() })
  const subject = adapter()
  const [a, b] = await Promise.all([collect(subject), collect(subject)])
  expect(a.at(-1)).toMatchObject({ type: 'finish', reason: { failure: { message: 'Connection error. (CERT_HAS_EXPIRED)' } } })
  expect(b.at(-1)).toMatchObject({ type: 'finish', reason: { failure: { message: 'Connection error. (ECONNRESET)' } } })
})
