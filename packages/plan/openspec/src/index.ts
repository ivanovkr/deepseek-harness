/** Built-in OpenSpec preparation, validation, and human review. */
import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, relative } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-fs'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-questions'
import type {} from '@deepseek-ai/dsh-working-directory'
import { artifactPath, changeName, snapshotArtifacts, writableArtifact } from './artifacts.ts'
import { runOpenSpec } from './cli.ts'


/** Cordis plugin name. */
export const name = 'openspec'
/** Services required for OpenSpec operations. */
export const inject = ['tools', 'workingDirectory', 'fs', 'subprocess', 'sandbox', 'sandboxPolicy']

/** Deployment-owned resource limits for OpenSpec operations. */
export interface Config {
  /** Deadline for one official OpenSpec invocation. */
  timeoutMs: number
  /** Combined stdout and stderr byte ceiling. */
  maxOutputBytes: number
  /** Managed subprocess termination grace period. */
  graceMs: number
  /** Complete planning document and review byte ceiling. */
  maxArtifactBytes: number
  /** Complete planning file and directory ceiling. */
  maxArtifactFiles: number
}

/** All deployment choices are explicit in the shipped bundle configuration. */
export const Config: z<Config> = z.object({
  timeoutMs: z.number().min(1).max(2147483647).required(),
  maxOutputBytes: z.number().min(1).required(),
  graceMs: z.number().min(1).max(2147483647).required(),
  maxArtifactBytes: z.number().min(1).required(),
  maxArtifactFiles: z.number().min(1).required(),
})

/**
 * Install OpenSpec preparation and review without changing ordinary tool permissions.
 * @param ctx - Host plugin context owning all registrations.
 * @param config - validated execution and artifact limits.
 */
export function apply(ctx: Context, config: Config): void {
  for (const key of ['timeoutMs', 'maxOutputBytes', 'graceMs', 'maxArtifactBytes', 'maxArtifactFiles'] as const) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 1) {
      throw new HarnessError(`OpenSpec ${key} must be a positive safe integer.`, 'OPENSPEC_INVALID_CONFIG')
    }
  }

  const project = (agent: Agent): string => {
    const root = realpathSync(ctx.workingDirectory.get(agent.session))
    if (ctx.fs.processPathFromHostPath(root) !== root) {
      throw new HarnessError('Built-in OpenSpec requires a filesystem shared with its packaged local runtime.', 'OPENSPEC_EXECUTION_WORLD_UNSUPPORTED')
    }
    return root
  }
  const snapshot = (agent: Agent, change: string) => snapshotArtifacts(project(agent), change, config)

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'openspec',
    description: 'For a user-requested project change, prepare and inspect OpenSpec documents, request human review, or validate the result. Do not use for ordinary chat. This tool does not change project tool permissions.',
    parameters: {
      operation: { type: 'string', enum: ['init', 'new', 'instructions', 'write', 'status', 'validate', 'review'], required: true, description: 'init sets up OpenSpec once; new creates a change; instructions returns official guidance; write saves a planning document; review presents the documents for an acceptance decision.' },
      change: { type: 'string', description: 'Lowercase kebab-case change identifier. Required except for init.' },
      artifact: { type: 'string', description: 'For write: proposal.md, design.md, tasks.md, or specs/<capability>/spec.md. For instructions: proposal, specs, design, tasks, or apply.' },
      content: { type: 'string', description: 'Complete UTF-8 planning document for write. Existing content is replaced.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        text: { type: 'string', required: true },
        accepted: { type: 'boolean', required: true },
      } },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    execute: async (args, exec) => {
      const agent = exec.agent
      if (agent === undefined) throw new HarnessError('OpenSpec requires a calling agent.', 'OPENSPEC_AGENT_REQUIRED')
      const root = project(agent)
      const filePolicy = ctx.sandboxPolicy.resolve({ session: agent.session })
      const change = args.operation === 'init' ? undefined : changeName(args.change ?? '')
      const base = change === undefined ? undefined : `openspec/changes/${change}`
      // All operations reject linked metadata before the CLI or file provider can follow it.
      artifactPath(root, 'openspec')
      if (base !== undefined) artifactPath(root, base)
      const cli = async (argv: readonly string[]) => {
        const result = await runOpenSpec(ctx, root, argv, exec.signal, config, filePolicy)
        if (result.exitCode !== 0) {
          throw new HarnessError(`OpenSpec failed (exit ${result.exitCode}):\n${result.stdout}\n${result.stderr}`, 'OPENSPEC_VALIDATION_FAILED')
        }
        return result.stdout + (result.stderr === '' ? '' : `\n${result.stderr}`)
      }
      const preparation = (): void => {
        if (filePolicy.mode === 'read-only') throw new HarnessError('OpenSpec preparation cannot write under the current read-only sandbox policy.', 'OPENSPEC_READ_ONLY')
        if (filePolicy.mode === 'workspace-write') {
          const within = relative(realpathSync(filePolicy.workspaceRoot), root)
          if (within === '..' || within.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(within)) {
            throw new HarnessError('OpenSpec preparation must stay inside the session workspace.', 'OPENSPEC_OUTSIDE_WORKSPACE')
          }
        }
      }
      switch (args.operation) {
        case 'init': {
          preparation()
          if (existsSync(artifactPath(root, 'openspec'))) throw new HarnessError('OpenSpec already exists; inspect it instead of reinitializing.', 'OPENSPEC_ALREADY_INITIALIZED')
          const text = await cli(['init', root, '--tools', 'none', '--no-animation'])
          return { text, accepted: false }
        }
        case 'new': {
          preparation()
          if (existsSync(artifactPath(root, base!))) throw new HarnessError('This OpenSpec change already exists; inspect its artifacts.', 'OPENSPEC_CHANGE_EXISTS')
          const text = await cli(['new', 'change', change!, '--json'])
          return { text, accepted: false }
        }
        case 'write': {
          preparation()
          const artifact = writableArtifact(args.artifact ?? '')
          const content = args.content
          if (content === undefined || content.trim() === '') throw new HarnessError('OpenSpec write requires a non-empty document.', 'OPENSPEC_INCOMPLETE')
          if (Buffer.byteLength(content) > config.maxArtifactBytes) throw new HarnessError('OpenSpec document exceeds the configured byte limit.', 'OPENSPEC_ARTIFACT_LIMIT')
          const path = artifactPath(root, `${base!}/${artifact}`)
          const target = await ctx.fs.resolve(path, { signal: exec.signal })
          await ctx.fs.writeText(target, content, undefined, exec.signal, filePolicy)
          return { text: `Saved ${base!}/${artifact}.`, accepted: false }
        }
        case 'instructions': {
          const artifact = args.artifact ?? 'proposal'
          if (!['proposal', 'specs', 'design', 'tasks', 'apply'].includes(artifact)) throw new HarnessError('Choose proposal, specs, design, tasks, or apply instructions.', 'OPENSPEC_INVALID_ARTIFACT')
          return { text: await cli(['instructions', artifact, '--change', change!, '--json']), accepted: false }
        }
        case 'status':
          return { text: await cli(['status', '--change', change!, '--json']), accepted: false }
        case 'validate':
          return { text: await cli(['validate', change!, '--type', 'change', '--strict', '--json', '--no-interactive']), accepted: false }
        case 'review': {
          const reviewed = snapshot(agent, change!)
          await cli(['validate', change!, '--type', 'change', '--strict', '--json', '--no-interactive'])
          const channel = ctx.get('userQuestions')
          if (channel === undefined) throw new HarnessError('No human review channel is available for this OpenSpec plan.', 'OPENSPEC_REVIEW_UNAVAILABLE')
          const answer = await channel.ask({
            agent,
            signal: exec.signal,
            questions: [{
              id: 'openspec-review',
              header: 'OpenSpec review',
              question: `Accept the OpenSpec plan for change ${change!}?`,
              detail: reviewed.detail,
              options: [{ label: 'Accept plan' }, { label: 'Keep planning' }],
              intent: { kind: 'plan-review', approve: 'Accept plan', callId: exec.callId },
            }],
          })
          exec.signal.throwIfAborted()
          ctx.fiber.assertActive()
          const answers = answer.answers.filter(item => item.id === 'openspec-review')
          const item = answers.length === 1 ? answers[0] : undefined
          if (item === undefined || item.selected.length !== 1 || item.selected[0] !== 'Accept plan' || item.custom !== undefined) {
            return { text: `OpenSpec plan was not accepted.${item?.custom === undefined ? '' : ` Feedback: ${item.custom}`}`, accepted: false }
          }
          const current = snapshot(agent, change!)
          if (current.root !== reviewed.root || current.digest !== reviewed.digest) throw new HarnessError('OpenSpec changed during review; present the current documents again.', 'OPENSPEC_REVIEW_STALE')
          return { text: `OpenSpec plan ${change!} was accepted by the user. This decision does not change tool permissions.`, accepted: true }
        }
      }
    },
    presentCall: args => ({ card: 'generic', title: 'OpenSpec', kind: 'other', content: [{ type: 'text', text: `${args.operation}${args.change === undefined ? '' : `: ${args.change}`}` }] }),
    presentResult: (_args, result) => ({ card: 'generic', title: 'OpenSpec', content: result.content }),
  })), 'openspec tool')
}
