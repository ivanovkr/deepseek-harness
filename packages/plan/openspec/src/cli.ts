/** Pinned OpenSpec CLI execution with bounded output and managed-process cleanup. */
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'

/**
 * Run the packaged OpenSpec CLI without a shell, PATH lookup, or runtime installation.
 * The caller allowlists arguments and supplies validated configuration limits. Nonzero
 * exits are values; process faults, cancellation, deadlines, and incomplete output reject.
 * Every published handle is terminated and awaited before settlement. A cleanup failure
 * reports unknown process state; CLI mutations are not rolled back on any failure.
 * @param ctx - context with the injected subprocess service.
 * @param root - project directory used as the child working directory.
 * @param args - caller-allowlisted upstream CLI arguments, excluding the executable.
 * @param signal - caller cancellation; rejection is named AbortError with code ABORTED.
 * @param limits - deadline, combined stdout/stderr byte cap, and provider termination grace.
 * @param policy - resolved caller file policy; confined modes fail closed with no escalation.
 * @returns complete stdout and stderr with the normal exit code, including nonzero codes.
 * @throws HarnessError when resolution, execution, cleanup, or output collection fails.
 */
export async function runOpenSpec(
  ctx: Context,
  root: string,
  args: readonly string[],
  signal: AbortSignal,
  limits: { timeoutMs: number; maxOutputBytes: number; graceMs: number },
  policy: SandboxExecutionPolicy,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const deadline = new AbortController()
  const timeout = new HarnessError(
    'OpenSpec exceeded its configured deadline. Project files may have changed; inspect them before retrying.',
    'OPENSPEC_CLI_TIMEOUT',
  )
  const operation = AbortSignal.any([signal, deadline.signal])
  const checkCancellation = (): void => {
    if (!operation.aborted) return
    if (operation.reason === timeout) throw timeout
    const error = new HarnessError(
      'OpenSpec was cancelled. Project files may have changed; inspect them before retrying.',
      'ABORTED',
      { cause: operation.reason },
    )
    error.name = 'AbortError'
    throw error
  }
  checkCancellation()
  const timer = setTimeout(() => deadline.abort(timeout), limits.timeoutMs)
  try {
    let bin: string
    try {
      bin = fileURLToPath(new URL('../bin/openspec.js', import.meta.resolve('@fission-ai/openspec')))
    } catch (error) {
      throw new HarnessError(
        'The packaged OpenSpec CLI could not be resolved. Repair the Harness installation before retrying.',
        'OPENSPEC_CLI_UNAVAILABLE',
        { cause: error },
      )
    }
    checkCancellation()
    const command = [process.execPath, bin, ...args]
    let argv: readonly string[]
    try {
      argv = policy.mode === 'danger-full-access'
        ? command
        : (await ctx.sandbox.confine(command, { ...policy, mode: policy.mode }, operation)).argv
    } catch (error) {
      checkCancellation()
      if (error instanceof HarnessError) throw error
      throw new HarnessError('OpenSpec confinement failed; refusing to run unconfined.', 'OPENSPEC_CLI_FAILED', { cause: error })
    }
    checkCancellation()
    let handle: SubprocessHandle
    try {
      handle = ctx.subprocess.spawn({
        argv,
        cwd: root,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: limits.maxOutputBytes },
          stderr: { maxBytes: limits.maxOutputBytes },
        },
        graceMs: limits.graceMs,
        signal: operation,
        env: {
          OPENSPEC_TELEMETRY: '0',
          OPENSPEC_NO_UPDATE_CHECK: '1',
          OPENSPEC_NO_COMPLETIONS: '1',
          ELECTRON_RUN_AS_NODE: '1',
        },
      })
    } catch (error) {
      checkCancellation()
      throw new HarnessError('OpenSpec could not start. Check the project directory and installation.', 'OPENSPEC_CLI_FAILED', { cause: error })
    }
    let outcome: SubprocessOutcome
    try {
      try {
        outcome = await handle.done
      } catch (error) {
        checkCancellation()
        throw new HarnessError(
          'OpenSpec execution failed. Project files may have changed; inspect them before retrying.',
          'OPENSPEC_CLI_FAILED',
          { cause: error },
        )
      }
    } finally {
      try {
        handle.terminate()
        if (!await handle.waitForExit()) throw new Error('The subprocess provider did not confirm quiescence')
      } catch (error) {
        throw new HarnessError(
          'OpenSpec process cleanup failed; surviving processes and project changes are unknown. Stop dependent work and inspect the project.',
          'OPENSPEC_CLI_QUIESCENCE_FAILED',
          { cause: error },
        )
      }
    }
    checkCancellation()
    if (outcome.exitCode === null || outcome.signal !== null) {
      throw new HarnessError(
        `OpenSpec ended without a normal exit (signal: ${outcome.signal}). Inspect project files before retrying.`,
        'OPENSPEC_CLI_FAILED',
      )
    }
    const stdout = handle.collected.stdout
    const stderr = handle.collected.stderr
    if (stdout === undefined || stderr === undefined) {
      throw new HarnessError('OpenSpec output collectors are unavailable; do not use this result.', 'OPENSPEC_CLI_FAILED')
    }
    const out = stdout.readFrom(0)
    const err = stderr.readFrom(0)
    if (out.lossy || err.lossy || out.nextOffset + err.nextOffset > limits.maxOutputBytes) {
      throw new HarnessError(
        'OpenSpec output exceeded the configured byte limit; no output is safe to parse. Inspect project files before retrying with a larger limit.',
        'OPENSPEC_CLI_OUTPUT_TRUNCATED',
      )
    }
    return { stdout: out.text, stderr: err.text, exitCode: outcome.exitCode }
  } finally {
    clearTimeout(timer)
  }
}
