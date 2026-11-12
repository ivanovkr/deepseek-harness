/** Loader composition exposes a human-guided authorization without a provider network call. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader, { type ModuleLoaderV2 } from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AuthorizationService from '@deepseek-ai/dsh-authorization'
import LocalCredentials from '@deepseek-ai/dsh-credentials-local'
import { credentialKey } from '@deepseek-ai/dsh-credentials'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

it('loads the conversation owner beside the registry and persists its flow result', async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-authorization-remote-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-credentials-local'",
    '  config:', `    path: ${JSON.stringify(join(root, '.credentials.yaml'))}`,
    "- name: '@deepseek-ai/dsh-authorization'",
    "- name: 'external-authorization-fixture'", '',
  ].join('\n'))
  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const key = credentialKey('llm-pi-ai', 'openai-codex')
  const externalFlow = {
    inject: ['authorization'],
    apply(flowCtx: Context) {
      flowCtx.authorization.registerFlow({ key, label: 'ChatGPT', methods: [{ id: 'oauth', label: 'Sign in' }],
        async run(session) {
          session.notify({ message: 'Continue in browser', url: 'https://example.test/authorize' })
          const code = await session.prompt({ kind: 'secret', message: 'Callback code' })
          if (code !== 'fixture-code') throw new Error('unexpected fixture answer')
          await session.commit({ kind: 'grant', payload: { token: 'fixture-token' } })
        },
      })
    },
  }
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-credentials-local', LocalCredentials],
    ['@deepseek-ai/dsh-authorization', AuthorizationService],
    ['external-authorization-fixture', externalFlow],
  ])
  const internal: ModuleLoaderV2 = {
    version: 'v2', loadCache: new Map(),
    import: async (specifier) => {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
    register(): never { throw new Error('unexpected module hook registration') },
    getOrCreateModuleJob(): never { throw new Error('unexpected module job creation') },
    resolveSync(): never { throw new Error('unexpected synchronous module resolution') },
    load(): never { throw new Error('unexpected module load') },
  }
  ctx.loader.internal = internal
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  expect(ctx.authorizationRemote.list()).toHaveLength(1)
  const stream = ctx.authorizationRemote.begin(key, 'oauth', new AbortController().signal)[Symbol.asyncIterator]()
  expect(await stream.next()).toMatchObject({ value: { type: 'notice' } })
  const prompt = await stream.next()
  if (prompt.done || prompt.value.type !== 'prompt') throw new Error('expected callback question')
  ctx.authorizationRemote.answer(key, prompt.value.id, 'fixture-code')
  expect(await stream.next()).toMatchObject({ value: { type: 'settled', status: 'authorized' } })
  await stream.next()
  expect(await ctx.authorizationRemote.status(key)).toEqual({ key, configured: true, writable: true, inFlight: false })
  expect(await ctx.credentials.readRecord(key)).toEqual({ kind: 'grant', payload: { token: 'fixture-token' } })
})
