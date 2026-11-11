/** Shared transport installed by the first-run settings through a real Loader tree. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, it } from 'vitest'
import { boot } from '@deepseek-ai/dsh-app-boot'
import { configurationFixture } from '../../../settings/settings/tests/configuration-fixture.ts'
import { proxyRouteFor } from '@deepseek-ai/dsh-http-proxy'
import * as models from '../src/index.ts'
import { Config, validProxyUrl } from '../src/onboarding-config.ts'

it.each(['socks5://localhost:1080', 'file:///proxy', 'http://proxy/path', 'http://proxy:99999', 'not a URL'])(
  'rejects an unsupported proxy before persistence: %s', (value) => {
    expect(validProxyUrl(value)).toBe(false)
    expect(() => Config({ proxyUrl: value })).toThrow()
  },
)

it('routes multiple model destinations through the saved proxy and restores routing on unload', async () => {
  const seen: string[] = []
  const server = createServer()
  server.on('connect', (request, socket) => {
    seen.push(request.url ?? '')
    socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
  })
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address() as AddressInfo
  const proxyUrl = `http://127.0.0.1:${String(address.port)}`
  const dir = await mkdtemp(join(tmpdir(), 'dsh-proxy-settings-'))
  const configPath = join(dir, 'cordis.yml')
  const original = proxyRouteFor(new URL('https://provider-one.invalid')).proxied
  let ctx: Awaited<ReturnType<typeof boot>> | undefined
  try {
    await writeFile(configPath, JSON.stringify([{
      id: 'ui-settings-models', name: 'cordis:test-model-settings',
      config: { proxyUrl, proxySetupComplete: true },
    }]))
    ctx = await boot('proxy-settings-test', configPath, undefined, (root) => {
      root.loader.builtins['test-model-settings'] = models
    })
    for (const host of ['provider-one.invalid', 'provider-two.invalid']) {
      await expect(fetch(`https://${host}/v1/messages`, { signal: AbortSignal.timeout(2000) })).rejects.toThrow()
    }
    expect(seen).toEqual(['provider-one.invalid:443', 'provider-two.invalid:443'])
    expect(proxyRouteFor(new URL('http://127.0.0.1/')).proxied).toBe(false)
    await ctx.fiber.dispose()
    expect(proxyRouteFor(new URL('https://provider-one.invalid')).proxied).toBe(original)
  } finally {
    await ctx?.fiber.dispose()
    await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
    await rm(dir, { recursive: true, force: true })
  }
})

it('exposes secret live settings and persists the initial proxy through the real settings writer', async () => {
  const fixture = await configurationFixture({ schema: Config, apply: (ctx, config) => models.apply(ctx, config as import('../src/onboarding-config.ts').Config) })
  const view = fixture.ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === 'first')!
  expect(view).toBeDefined()
  await fixture.ctx.settings.mutate('first', [
    { op: 'set', path: ['proxyUrl'], value: 'http://user:password@proxy.example:8080' },
    { op: 'set', path: ['proxySetupComplete'], value: true },
  ], view.revision)
  await expect.poll(() => proxyRouteFor(new URL('https://model.example')).proxied).toBe(true)
  const saved = fixture.ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === 'first')!
  expect(JSON.stringify(saved.value)).not.toContain('password')
  expect(saved.value).toMatchObject({ proxySetupComplete: true })
  expect(proxyRouteFor(new URL('https://model.example')).proxy).toBe('http://user:password@proxy.example:8080')
  await fixture.ctx.fiber.dispose()
  await fixture.start()
  expect(proxyRouteFor(new URL('https://model.example')).proxy).toBe('http://user:password@proxy.example:8080')
})
