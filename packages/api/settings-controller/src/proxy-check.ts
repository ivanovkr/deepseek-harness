/** One-shot Host-side connectivity check for a candidate HTTP proxy. */

import { createRouteDispatcher } from '@deepseek-ai/dsh-http-proxy'
import type { ProxyCheckOutcome } from './types.ts'

const PROBE_URL = 'https://api.deepseek.com/anthropic/v1/messages'
const PROBE_TIMEOUT_MS = 8_000

/**
 * Send one unauthenticated Messages API request through the candidate proxy.
 * Any HTTP response proves the proxy connected to the same endpoint used by the
 * built-in DeepSeek chat adapter; 401 is expected because no API key is sent.
 * @param proxyUrl - validated HTTP(S) proxy URL, possibly containing credentials.
 * @param verifyTls - whether to verify proxy and destination certificates for TLS requests.
 * @param signal - caller cancellation signal.
 * @returns a classified result without proxy credentials or raw network errors.
 */
export async function checkProxyConnection(proxyUrl: string, verifyTls: boolean, signal: AbortSignal): Promise<ProxyCheckOutcome> {
  let parsed: URL
  try {
    parsed = new URL(proxyUrl)
  } catch (error: unknown) {
    if (error instanceof TypeError) return { kind: 'failed' }
    throw error
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname === ''
    || parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') return { kind: 'failed' }

  const deadline = AbortSignal.timeout(PROBE_TIMEOUT_MS)
  const requestSignal = AbortSignal.any([signal, deadline])
  const dispatcher = await createRouteDispatcher({
    get: name => ['HTTP_PROXY', 'HTTPS_PROXY'].includes(name) ? { value: proxyUrl } : undefined,
  }, { allowH2: false, verifyTls })
  try {
    const response = await fetch(PROBE_URL, {
      method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: '{}', signal: requestSignal, dispatcher,
    } as RequestInit & { dispatcher: object })
    await response.body?.cancel()
    return response.status === 407 ? { kind: 'proxy-auth' } : { kind: 'connected', status: response.status }
  } catch (error: unknown) {
    if (signal.aborted) throw signal.reason
    if (deadline.aborted) return { kind: 'timeout' }
    return { kind: errorStatus(error) === 407 ? 'proxy-auth' : classifyNetworkError(error) }
  } finally {
    await dispatcher.close()
  }
}

/** Read only an HTTP status from a native or undici error. */
function errorStatus(error: unknown, seen = new Set<object>()): number | undefined {
  if (typeof error !== 'object' || error === null || seen.has(error)) return undefined
  seen.add(error)
  const direct = Reflect.get(error, 'statusCode')
  if (typeof direct === 'number') return direct
  return errorStatus(Reflect.get(error, 'cause'), seen)
}

/** Classify transport errors without returning dependency messages or proxy credentials. */
function classifyNetworkError(error: unknown): Exclude<ProxyCheckOutcome, { kind: 'connected' } | { kind: 'proxy-auth' }>['kind'] {
  const codes = errorCodes(error)
  if (codes.some(code => ['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code))) return 'refused'
  if (codes.some(code => ['ENOTFOUND', 'EAI_AGAIN', 'EAI_FAIL'].includes(code))) return 'dns'
  if (codes.some(code => code.includes('CERT') || code.includes('TLS') || code.includes('SSL'))) return 'tls'
  if (codes.some(code => code.includes('TIMEOUT') || code === 'ETIMEDOUT' || code === 'ABORT_ERR')) return 'timeout'
  return 'failed'
}

/** Read only the machine code from a native or undici error. */
function errorCodes(error: unknown, seen = new Set<object>()): string[] {
  if (typeof error !== 'object' || error === null || seen.has(error)) return []
  seen.add(error)
  const codes: string[] = []
  const direct = Reflect.get(error, 'code')
  if (typeof direct === 'string') codes.push(direct.toUpperCase())
  codes.push(...errorCodes(Reflect.get(error, 'cause'), seen))
  const errors = Reflect.get(error, 'errors')
  if (Array.isArray(errors)) {
    for (const nested of errors) codes.push(...errorCodes(nested, seen))
  }
  return codes
}
