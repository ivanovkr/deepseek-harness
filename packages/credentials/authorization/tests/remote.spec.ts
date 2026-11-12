import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AuthorizationService, { type AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { AuthorizationRemoteEvent } from '../src/remote-types.ts'
import { MemoryCredentials } from './memory.ts'
import type { PeerId, RemoteInvocation } from '@deepseek-ai/dsh-typert-protocol'

function caller(ctx: Context, name: string): Context['authorizationRemote'] {
  const signal = new AbortController().signal
  const invocation: RemoteInvocation = {
    request: { namespace: 'authorization', method: 'test', args: {} },
    service: 'authorizationRemote', signal,
    uplink: async function* () {},
    peer: { id: name as PeerId, ctx, principal: { kind: 'owner' }, signal, interactions: 'answer',
      dispose: () => Promise.resolve() },
  }
  const service = ctx.extend({ invocation }).get('authorizationRemote')
  if (service === undefined) throw new Error('missing Remote owner')
  return service
}

const KEY = credentialKey('llm-pi-ai', 'openai-codex')
const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

async function harness(run: (session: AuthorizationSession) => Promise<void>): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(MemoryCredentials)
  await ctx.plugin(AuthorizationService)
  ctx.authorization.registerFlow({ key: KEY, label: 'ChatGPT',
    methods: [{ id: 'oauth', label: 'Sign in' }], run })
  return ctx
}

function promptId(event: IteratorResult<AuthorizationRemoteEvent>): import('../src/remote-types.ts').AuthorizationPromptId {
  if (event.done || event.value.type !== 'prompt') throw new Error('expected prompt')
  return event.value.id
}

describe('authorization Remote conversation', () => {
  it('streams notices and questions, commits once, and returns redacted credential status', async () => {
    const ctx = await harness(async (session) => {
      session.notify({ message: 'Open browser', url: 'https://example.test/login' })
      const answer = await session.prompt({ kind: 'secret', message: 'Paste callback' })
      expect(answer).toBe('private-answer')
      await session.commit({ kind: 'grant', payload: { token: 'private-token' } })
    })
    const remote = ctx.authorizationRemote
    expect(remote.list()).toEqual([{ key: KEY, label: 'ChatGPT', methods: [{ id: 'oauth', label: 'Sign in' }], inFlight: false }])
    expect(await remote.status(KEY)).toEqual({ key: KEY, configured: false, writable: true, inFlight: false })
    const stream = remote.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    expect(await stream.next()).toEqual({ done: false, value: { type: 'notice', notice: {
      message: 'Open browser', url: 'https://example.test/login',
    } } })
    const id = promptId(await stream.next())
    expect(await remote.status(KEY)).toMatchObject({ inFlight: true })
    remote.answer(KEY, id, 'private-answer')
    expect(await stream.next()).toEqual({ done: false, value: { type: 'settled', status: 'authorized' } })
    expect(await stream.next()).toEqual({ done: true, value: undefined })
    expect(await remote.status(KEY)).toEqual({ key: KEY, configured: true, writable: true, inFlight: false })
    expect(JSON.stringify(await remote.status(KEY))).not.toContain('private')
    expect(() => remote.answer(KEY, id, 'private-answer')).toThrow()
  })

  it('withdraws a losing prompt without cancelling the authorization', async () => {
    const question = new AbortController()
    const ctx = await harness(async (session) => {
      await session.prompt({ kind: 'text', message: 'Code', signal: question.signal }).catch(() => undefined)
      await session.commit({ kind: 'grant', payload: { token: 'token' } })
    })
    const stream = ctx.authorizationRemote.begin(KEY, undefined, new AbortController().signal)[Symbol.asyncIterator]()
    const id = promptId(await stream.next())
    question.abort()
    expect(await stream.next()).toEqual({ done: false, value: { type: 'prompt-withdrawn', id } })
    expect(() => ctx.authorizationRemote.answer(KEY, id, 'too-late')).toThrow()
    expect(await stream.next()).toMatchObject({ value: { type: 'settled', status: 'authorized' } })
    await stream.next()
  })

  it('cancels on disconnect and releases the key before the next attempt', async () => {
    const ctx = await harness(async session => { await session.prompt({ kind: 'text', message: 'Code' }) })
    const lifetime = new AbortController()
    const stream = ctx.authorizationRemote.begin(KEY, 'oauth', lifetime.signal)[Symbol.asyncIterator]()
    const first = promptId(await stream.next())
    lifetime.abort()
    expect(await stream.next()).toMatchObject({ value: { type: 'settled', status: 'cancelled' } })
    await stream.next()
    expect(ctx.authorization.describe(KEY)?.inFlight).toBe(false)
    const next = ctx.authorizationRemote.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    const second = promptId(await next.next())
    expect(second).not.toBe(first)
    expect(() => ctx.authorizationRemote.answer(KEY, first, 'stale')).toThrow()
    ctx.authorizationRemote.cancel(KEY)
    expect(await next.next()).toMatchObject({ value: { type: 'settled', status: 'cancelled' } })
    await next.next()
  })

  it('refuses duplicate streams without cancelling the first attempt', async () => {
    const ctx = await harness(async session => { await session.prompt({ kind: 'text', message: 'Code' }) })
    const first = ctx.authorizationRemote.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    promptId(await first.next())
    const second = ctx.authorizationRemote.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    await expect(second.next()).rejects.toMatchObject({ code: 'authorization/rejected', details: { code: 'ALREADY_IN_FLIGHT' } })
    expect(ctx.authorization.describe(KEY)?.inFlight).toBe(true)
    ctx.authorizationRemote.cancel(KEY)
    expect(await first.next()).toMatchObject({ value: { status: 'cancelled' } })
    await first.next()
  })

  it('binds prompt answers and cancellation to the initiating peer', async () => {
    const ctx = await harness(async session => { await session.prompt({ kind: 'text', message: 'Code' }) })
    const owner = caller(ctx, 'one')
    const other = caller(ctx, 'two')
    const stream = owner.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    const id = promptId(await stream.next())
    expect(() => other.answer(KEY, id, 'wrong-peer')).toThrow()
    expect(() => other.cancel(KEY)).toThrow()
    expect(ctx.authorization.describe(KEY)?.inFlight).toBe(true)
    owner.cancel(KEY)
    expect(await stream.next()).toMatchObject({ value: { status: 'cancelled' } })
    await stream.next()
  })

  it('rejects invalid select answers without retiring the question', async () => {
    const ctx = await harness(async (session) => {
      expect(await session.prompt({ kind: 'select', message: 'Account', options: [{ id: 'one', label: 'One' }] })).toBe('one')
      await session.commit({ kind: 'grant', payload: {} })
    })
    const stream = ctx.authorizationRemote.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    const id = promptId(await stream.next())
    expect(() => ctx.authorizationRemote.answer(KEY, id, 'invalid')).toThrow()
    ctx.authorizationRemote.answer(KEY, id, 'one')
    expect(await stream.next()).toMatchObject({ value: { status: 'authorized' } })
    await stream.next()
  })

  it('redacts provider errors, includes a safe diagnostic category, and refuses unknown flows or methods', async () => {
    const ctx = await harness(async () => { throw new Error('private-token in provider error') })
    const failed = ctx.authorizationRemote.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    await expect(failed.next()).rejects.toMatchObject({ code: 'authorization/rejected', details: { code: 'FLOW_FAILED', diagnostic: 'UNKNOWN' } })
    const invalid = ctx.authorizationRemote.begin(KEY, 'unknown', new AbortController().signal)[Symbol.asyncIterator]()
    await expect(invalid.next()).rejects.toMatchObject({ details: { code: 'UNKNOWN_METHOD' } })
    await expect(ctx.authorizationRemote.status(credentialKey('missing', 'flow'))).rejects.toMatchObject({
      details: { code: 'NO_FLOW' },
    })
    expect(ctx.authorization.describe(KEY)?.inFlight).toBe(false)
  })

  it('classifies network failures without forwarding provider messages or credentials', async () => {
    const cause = Object.assign(new Error('private proxy URL and token=secret'), { code: 'ENOTFOUND' })
    const ctx = await harness(async () => { throw new TypeError('fetch failed', { cause }) })
    const failed = ctx.authorizationRemote.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    await expect(failed.next()).rejects.toMatchObject({
      code: 'authorization/rejected',
      message: 'Authorization could not complete (FLOW_FAILED).',
      details: { code: 'FLOW_FAILED', diagnostic: 'DNS_LOOKUP' },
    })
  })

  it('disposal cancels pending work and unregisters the Remote owner', async () => {
    const ctx = await harness(async session => { await session.prompt({ kind: 'text', message: 'Code' }) })
    const stream = ctx.authorizationRemote.begin(KEY, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
    promptId(await stream.next())
    await ctx.fiber.dispose()
    expect(ctx.get('authorizationRemote')).toBeUndefined()
    expect(await stream.next()).toMatchObject({ value: { type: 'settled', status: 'cancelled' } })
    await stream.next()
  })
})
