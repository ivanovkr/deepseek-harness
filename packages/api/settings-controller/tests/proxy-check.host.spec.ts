import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createDispatcher: vi.fn(async () => ({ close: vi.fn(async () => {}) })),
}))

vi.mock('@deepseek-ai/dsh-http-proxy', () => ({ createRouteDispatcher: mocks.createDispatcher }))

import { checkProxyConnection } from '../src/proxy-check.ts'

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

it('checks the DeepSeek API through the candidate proxy and treats its unauthenticated response as connected', async () => {
  const cancel = vi.fn(async () => {})
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 401 }))

  await expect(checkProxyConnection('http://user:secret@proxy.example:8080', true, new AbortController().signal))
    .resolves.toEqual({ kind: 'connected', status: 401 })
  expect(mocks.createDispatcher).toHaveBeenCalledWith({
    get: expect.any(Function),
  }, { allowH2: false, verifyTls: true })
  expect(fetch).toHaveBeenCalledWith('https://api.deepseek.com/anthropic/v1/messages', expect.objectContaining({ method: 'POST' }))
  expect(cancel).not.toHaveBeenCalled()
})

it('passes the explicit TLS verification choice to the proxy transport', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 401 }))
  await expect(checkProxyConnection('http://proxy.example:8080', false, new AbortController().signal))
    .resolves.toEqual({ kind: 'connected', status: 401 })
  expect(mocks.createDispatcher).toHaveBeenCalledWith({ get: expect.any(Function) }, { allowH2: false, verifyTls: false })
})

it('identifies an HTTP proxy authentication rejection', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 407 }))
  await expect(checkProxyConnection('http://proxy.example:8080', true, new AbortController().signal))
    .resolves.toEqual({ kind: 'proxy-auth' })
})

it.each([
  ['ENOTFOUND', 'dns'],
  ['ECONNREFUSED', 'refused'],
  ['UND_ERR_CONNECT_TIMEOUT', 'timeout'],
  ['ETIMEDOUT', 'timeout'],
  ['ERR_TLS_CERT_ALTNAME_INVALID', 'tls'],
  ['OTHER_FAILURE', 'failed'],
] as const)('classifies network error %s without exposing its message', async (code, kind) => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(Object.assign(new Error('http://user:secret@proxy.example failed'), { code }))
  await expect(checkProxyConnection('http://proxy.example:8080', true, new AbortController().signal))
    .resolves.toEqual({ kind })
})

it('classifies aggregate connection failures from the transport', async () => {
  const failure = new AggregateError([Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })], 'all addresses failed')
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(failure)
  await expect(checkProxyConnection('http://proxy.example:8080', true, new AbortController().signal))
    .resolves.toEqual({ kind: 'refused' })
})

it('classifies an HTTP proxy tunnel authentication failure', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(Object.assign(new Error('proxy tunnel failed'), { statusCode: 407 }))
  await expect(checkProxyConnection('http://proxy.example:8080', true, new AbortController().signal))
    .resolves.toEqual({ kind: 'proxy-auth' })
})

it('rejects invalid or unsupported URLs without contacting the network', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  await expect(checkProxyConnection('socks5://proxy.example:1080', true, new AbortController().signal))
    .resolves.toEqual({ kind: 'failed' })
  expect(fetch).not.toHaveBeenCalled()
  expect(mocks.createDispatcher).not.toHaveBeenCalled()
})

it('propagates caller cancellation while closing its private dispatcher', async () => {
  const controller = new AbortController()
  const reason = new Error('cancelled')
  vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, options) => {
    controller.abort(reason)
    options?.signal?.throwIfAborted()
    return new Response(null)
  })
  await expect(checkProxyConnection('http://proxy.example:8080', true, controller.signal)).rejects.toBe(reason)
  const dispatcher = await mocks.createDispatcher.mock.results[0]?.value
  expect(dispatcher?.close).toHaveBeenCalledOnce()
})
