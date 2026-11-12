import { expect, it, onTestFinished, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ResourceRegistry } from '@deepseek-ai/dsh-client-resources/src/client/resources.ts'
import * as development from '../src/client/index.ts'

it('removes view, dictionaries and resource providers on plugin disposal', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const slots = new SlotRegistry(ctx)
  slots.register({ name: 'root', children: { 'conversation.view': { kind: 'list', scope: 'session' } } }, () => null)
  const dictionaries = new Set<string>()
  ctx.provide('locale', {
    register: (namespace: string) => { dictionaries.add(namespace); return () => { dictionaries.delete(namespace) } },
    bind: () => (key: string) => key,
  } as Context['locale'])
  const resources = new ResourceRegistry(ctx)
  ctx.provide('resources', resources)
  const list = vi.fn(async () => ({ ok: true, value: { path: '', entries: [], truncated: false } }))
  ctx.provide('remote', { workspaceFiles: { list } } as Context['remote'])
  ctx.provide('remote.workspaceFiles', { list } as Context['remote']['workspaceFiles'])
  const fiber = ctx.plugin(development, { maxChanges: 3, maxSpecFiles: 3, maxDocumentBytes: 100, maxDocumentPages: 3 })
  await fiber.await()
  expect(slots.entries('conversation.view').map(entry => entry.options.id)).toEqual(['development'])
  expect(dictionaries.has('development')).toBe(true)
  await fiber.dispose()
  expect(slots.entries('conversation.view')).toHaveLength(0)
  expect(dictionaries.size).toBe(0)
  const source = resources.source('dsh-resource://development-board/session')
  const unsubscribe = source.subscribe(() => {})
  expect(source.getSnapshot().status).toBe('none')
  unsubscribe()
  expect(list).not.toHaveBeenCalled()
})
