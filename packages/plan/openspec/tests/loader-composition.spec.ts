/** The OpenSpec review interaction does not install a global tool-execution guard. */
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools, { defineTool } from '@deepseek-ai/dsh-tools'
import * as Native from '@deepseek-ai/dsh-tool-executor-native'
import { executeModelToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import * as OpenSpec from '../src/index.ts'
import { afterEach, expect, it } from 'vitest'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

it('leaves project tools available before and after OpenSpec is mounted', async () => {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  await ctx.plugin(Native)

  let mutated = false
  ctx.tools.register(defineTool({
    name: 'write', description: 'Mutation probe', parameters: {},
    output: { schema: { type: 'boolean' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    execute: async () => { mutated = true; return true },
  }))

  const session = ctx.sessions.create()
  const agent = { id: session.id, session, ctx } as Agent
  const run = () => executeModelToolFixture(ctx, {
    name: 'write', arguments: {}, agent, callId: ToolCallId('write'), signal: new AbortController().signal,
  })
  expect((await run()).isError).toBe(false)
  expect(mutated).toBe(true)
  mutated = false

  OpenSpec.apply(ctx, {
    timeoutMs: 60000,
    maxOutputBytes: 131072,
    graceMs: 2000,
    maxArtifactBytes: 262144,
    maxArtifactFiles: 64,
  })
  expect(ctx.tools.definitions().map(tool => tool.name)).toContain('openspec')
  expect((await run()).isError).toBe(false)
  expect(mutated).toBe(true)
})
