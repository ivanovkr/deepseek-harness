/** OpenSpec subprocess requests, bounded results, and quiescent failure paths. */
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { SandboxProvider, SandboxUnavailableError } from '@deepseek-ai/dsh-sandbox'
import type { SandboxExecutionPolicy, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import { SessionId } from '@deepseek-ai/dsh-session'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type { SubprocessHandle, SubprocessOutcome, SubprocessSpawnSpec, SubprocessTerminalHandle } from '@deepseek-ai/dsh-subprocess'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runOpenSpec } from '../src/cli.ts'

const contexts: Context[] = []
const limits = { timeoutMs: 1000, maxOutputBytes: 20, graceMs: 15 }

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function processHandle(stdout = '', stderr = '', exitCode = 0) {
  return {
    stdin: undefined,
    stdout: undefined,
    stderr: undefined,
    control: undefined,
    collected: {
      stdout: { readFrom: vi.fn(() => ({ text: stdout, nextOffset: Buffer.byteLength(stdout), lossy: false })) },
      stderr: { readFrom: vi.fn(() => ({ text: stderr, nextOffset: Buffer.byteLength(stderr), lossy: false })) },
    },
    done: Promise.resolve<SubprocessOutcome>({ exitCode, signal: null }),
    terminate: vi.fn(),
    waitForExit: vi.fn(() => Promise.resolve(true)),
  } satisfies SubprocessHandle
}

async function harness(handle: SubprocessHandle = processHandle()) {
  class StubSubprocess extends SubprocessRuntime {
    spawn = vi.fn((_spec: SubprocessSpawnSpec) => handle)
    async resolveExecutable(): Promise<string> { throw new Error('No executable lookup is allowed') }
    async terminalEnvironment(): Promise<never> { throw new Error('No terminal is allowed') }
    async spawnTerminal(): Promise<SubprocessTerminalHandle> { throw new Error('No terminal is allowed') }
  }
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(StubSubprocess)
  class StubSandbox extends SandboxProvider {
    failure: Error | undefined
    confine = vi.fn(async (argv: readonly string[], _policy: SandboxPolicy) => {
      if (this.failure !== undefined) throw this.failure
      return { argv: ['sandbox-runner', ...argv], enforcement: 'full' as const, denialSignatures: [], runnerFailureRules: [] }
    })
  }
  await ctx.plugin(StubSandbox)
  const sandbox = ctx.sandbox as StubSandbox
  const subprocess = ctx.subprocess as StubSubprocess
  const controller = new AbortController()
  const run = (config = limits, policy: SandboxExecutionPolicy = { mode: 'danger-full-access', workspaceRoot: '/project' }) => runOpenSpec(ctx, '/project', ['status', '--change', 'feature', '--json'], controller.signal, config, policy)
  return { ctx, subprocess, sandbox, controller, run }
}

async function expectFailure(result: Promise<unknown>, code: string, cause?: unknown) {
  const failure = await result.then(() => { throw new Error('Expected OpenSpec to reject') }, (error: unknown) => error)
  expect(failure).toBeInstanceOf(HarnessError)
  expect(failure).toMatchObject({ name: code === 'ABORTED' ? 'AbortError' : 'HarnessError', code })
  if (cause !== undefined) expect(failure).toHaveProperty('cause', cause)
}

describe('packaged OpenSpec CLI runner', () => {
  it('confines the exact command under the caller policy before spawning', async () => {
    const bench = await harness()
    const policy: SandboxExecutionPolicy = { mode: 'workspace-write', workspaceRoot: '/project', sessionId: SessionId('review') }
    await bench.run(limits, policy)
    expect(bench.sandbox.confine).toHaveBeenCalledWith(expect.arrayContaining([process.execPath]), policy, expect.any(AbortSignal))
    expect(bench.subprocess.spawn.mock.calls[0]![0].argv[0]).toBe('sandbox-runner')
  })

  it('fails closed instead of falling back when sandbox preparation rejects', async () => {
    const bench = await harness()
    bench.sandbox.failure = new SandboxUnavailableError('read-only')
    await expect(bench.run(limits, { mode: 'read-only', workspaceRoot: '/project' })).rejects.toBe(bench.sandbox.failure)
    expect(bench.subprocess.spawn).not.toHaveBeenCalled()
  })

  it('spawns the pinned package bin under Node with explicit execution settings', async () => {
    const handle = processHandle('{"ok":true}', 'warning', 3)
    const bench = await harness(handle)
    await expect(bench.run()).resolves.toEqual({ stdout: '{"ok":true}', stderr: 'warning', exitCode: 3 })
    expect(bench.subprocess.spawn).toHaveBeenCalledExactlyOnceWith({
      argv: [
        process.execPath,
        fileURLToPath(new URL('../bin/openspec.js', import.meta.resolve('@fission-ai/openspec'))),
        'status', '--change', 'feature', '--json',
      ],
      cwd: '/project',
      stdio: { stdin: 'ignore', stdout: { maxBytes: 20 }, stderr: { maxBytes: 20 } },
      graceMs: 15,
      signal: expect.any(AbortSignal),
      env: {
        OPENSPEC_TELEMETRY: '0',
        OPENSPEC_NO_UPDATE_CHECK: '1',
        OPENSPEC_NO_COMPLETIONS: '1',
        ELECTRON_RUN_AS_NODE: '1',
      },
    })
    expect(handle.terminate).toHaveBeenCalledOnce()
    expect(handle.waitForExit).toHaveBeenCalledExactlyOnceWith()
    expect(handle.collected.stdout.readFrom).toHaveBeenCalledExactlyOnceWith(0)
    expect(handle.collected.stderr.readFrom).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('accepts empty results and an exact combined multibyte byte limit', async () => {
    const empty = await harness()
    await expect(empty.run()).resolves.toEqual({ stdout: '', stderr: '', exitCode: 0 })
    const bench = await harness(processHandle('é', 'x'))
    await expect(bench.run({ ...limits, maxOutputBytes: 3 })).resolves.toEqual({ stdout: 'é', stderr: 'x', exitCode: 0 })
  })

  it('rejects a combined byte overflow even when neither collector lost bytes', async () => {
    const bench = await harness(processHandle('é', 'xx'))
    await expectFailure(bench.run({ ...limits, maxOutputBytes: 3 }), 'OPENSPEC_CLI_OUTPUT_TRUNCATED')
  })

  it.each(['stdout', 'stderr'] as const)('rejects truncated %s instead of returning parseable-looking output', async (stream) => {
    const handle = processHandle('{"ok":true}')
    handle.collected[stream].readFrom.mockReturnValue({ text: '{}', nextOffset: 100, lossy: true })
    const bench = await harness(handle)
    await expectFailure(bench.run(), 'OPENSPEC_CLI_OUTPUT_TRUNCATED')
    expect(handle.waitForExit).toHaveBeenCalledOnce()
  })

  it('does not settle until managed-range quiescence after the direct process exits', async () => {
    const handle = processHandle('done')
    const waiting = Promise.withResolvers<void>()
    const quiescent = Promise.withResolvers<boolean>()
    handle.waitForExit.mockImplementation(() => {
      expect(handle.terminate).toHaveBeenCalledOnce()
      waiting.resolve()
      return quiescent.promise
    })
    const bench = await harness(handle)
    let settled = false
    const run = bench.run().finally(() => { settled = true })
    try {
      await waiting.promise
      expect(settled).toBe(false)
      expect(handle.collected.stdout.readFrom).not.toHaveBeenCalled()
    } finally {
      quiescent.resolve(true)
      await expect(run).resolves.toMatchObject({ stdout: 'done' })
    }
  })

  it('converts a synchronous spawn fault and preserves its cause', async () => {
    const bench = await harness()
    const cause = new Error('spawn refused')
    bench.subprocess.spawn.mockImplementation(() => { throw cause })
    await expectFailure(bench.run(), 'OPENSPEC_CLI_FAILED', cause)
  })

  it('cleans up a rejected process outcome before reporting the fault', async () => {
    const handle = processHandle()
    const bench = await harness(handle)
    const cause = new Error('runner failed')
    handle.done = Promise.reject(cause)
    await expectFailure(bench.run(), 'OPENSPEC_CLI_FAILED', cause)
    expect(handle.terminate).toHaveBeenCalledOnce()
    expect(handle.waitForExit).toHaveBeenCalledOnce()
  })

  it.each([
    { exitCode: null, signal: 'SIGTERM' },
    { exitCode: null, signal: null },
    { exitCode: 0, signal: 'SIGTERM' },
  ] satisfies SubprocessOutcome[])('rejects abnormal process outcome %j', async (outcome) => {
    const handle = processHandle()
    handle.done = Promise.resolve(outcome)
    const bench = await harness(handle)
    await expectFailure(bench.run(), 'OPENSPEC_CLI_FAILED')
  })

  it.each(['stdout', 'stderr'] as const)('rejects unavailable %s rather than substituting an empty result', async (stream) => {
    const handle: SubprocessHandle = processHandle()
    const bench = await harness({ ...handle, collected: stream === 'stdout' ? { stderr: handle.collected.stderr! } : { stdout: handle.collected.stdout! } })
    await expectFailure(bench.run(), 'OPENSPEC_CLI_FAILED')
  })

  it('reports uncertain cleanup with its own code and original cause', async () => {
    const handle = processHandle()
    const cause = new Error('range observation failed')
    handle.waitForExit.mockRejectedValue(cause)
    const bench = await harness(handle)
    await expectFailure(bench.run(), 'OPENSPEC_CLI_QUIESCENCE_FAILED', cause)
  })

  it('rejects a provider that does not confirm quiescence', async () => {
    const handle = processHandle()
    handle.waitForExit.mockResolvedValue(false)
    const bench = await harness(handle)
    await expectFailure(bench.run(), 'OPENSPEC_CLI_QUIESCENCE_FAILED')
  })

  it('converts termination faults rather than returning the direct process result', async () => {
    const handle = processHandle()
    const cause = new Error('termination failed')
    handle.terminate.mockImplementation(() => { throw cause })
    const bench = await harness(handle)
    await expectFailure(bench.run(), 'OPENSPEC_CLI_QUIESCENCE_FAILED', cause)
  })

  it('does not spawn after caller cancellation', async () => {
    const bench = await harness()
    const cause = new Error('caller stopped')
    bench.controller.abort(cause)
    await expectFailure(bench.run(), 'ABORTED', cause)
    expect(bench.subprocess.spawn).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)('awaits cleanup after active cancellation when done promises %s', async (mode) => {
    const handle = processHandle()
    const done = Promise.withResolvers<SubprocessOutcome>()
    handle.done = done.promise
    const bench = await harness(handle)
    const run = expectFailure(bench.run(), 'ABORTED')
    const spec = bench.subprocess.spawn.mock.calls[0]![0]
    expect(spec.signal!.aborted).toBe(false)
    bench.controller.abort()
    expect(spec.signal!.aborted).toBe(true)
    if (mode === 'resolve') done.resolve({ exitCode: 0, signal: null })
    else done.reject(new Error('cancelled provider'))
    await run
    expect(handle.terminate).toHaveBeenCalledOnce()
    expect(handle.waitForExit).toHaveBeenCalledOnce()
  })

  it('classifies the configured deadline independently of a zero exit and clears its timer', async () => {
    vi.useFakeTimers()
    const handle = processHandle()
    const done = Promise.withResolvers<SubprocessOutcome>()
    handle.done = done.promise
    const bench = await harness(handle)
    const run = expectFailure(bench.run(), 'OPENSPEC_CLI_TIMEOUT')
    const spec = bench.subprocess.spawn.mock.calls[0]![0]
    await vi.advanceTimersByTimeAsync(limits.timeoutMs)
    expect(spec.signal!.aborted).toBe(true)
    done.resolve({ exitCode: 0, signal: null })
    await run
    expect(handle.waitForExit).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the deadline active during cleanup and prioritizes cleanup failure over cancellation', async () => {
    vi.useFakeTimers()
    const handle = processHandle()
    const waiting = Promise.withResolvers<void>()
    const quiescent = Promise.withResolvers<boolean>()
    handle.waitForExit.mockImplementation(() => {
      waiting.resolve()
      return quiescent.promise
    })
    const bench = await harness(handle)
    const run = expectFailure(bench.run(), 'OPENSPEC_CLI_QUIESCENCE_FAILED')
    try {
      await waiting.promise
      await vi.advanceTimersByTimeAsync(limits.timeoutMs)
      expect(bench.subprocess.spawn.mock.calls[0]![0].signal!.aborted).toBe(true)
    } finally {
      quiescent.reject(new Error('quiescence unknown'))
      await run
    }
    expect(vi.getTimerCount()).toBe(0)
  })
})
