/** Guarded saves use the real filesystem and the resolved Session's authority. */
import { readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SessionStore, { type Session } from '@deepseek-ai/dsh-session'
import { FsError } from '@deepseek-ai/dsh-fs'
import { openWorkspace, failureOf, signal, type Harness } from './harness.ts'

let harness: Harness
let session: Session
beforeEach(async () => {
  harness = await openWorkspace('dsh-workspace-save-')
  await harness.ctx.plugin(SessionStore)
  session = harness.ctx.sessions.create(harness.scope.sessionId, { meta: { cwd: harness.workspace } })
  await writeFile(join(harness.workspace, 'file.txt'), 'original\r\n')
})
afterEach(async () => {
  await harness.ctx.fiber.dispose()
  await harness.dispose()
})

it('saves exact UTF-8 bytes and returns the committed version without a second stat', async () => {
  const service = harness.endpoint()
  const before = await service.stat(harness.scope, 'file.txt', signal())
  const resolve = vi.spyOn(harness.ctx.sandboxPolicy, 'resolve')
  const write = vi.spyOn(harness.ctx.fs, 'writeText')
  const stat = vi.spyOn(harness.ctx.fs, 'stat')
  const content = '\ufeff你好\r\nlast\n'
  const result = await service.writeText(session, 'file.txt', content, before.version, signal())
  expect(await readFile(join(harness.workspace, 'file.txt'), 'utf8')).toBe(content)
  expect(result).toMatchObject({ absolutePath: before.absolutePath, bytes: Buffer.byteLength(content) })
  expect(result.version).not.toBe(before.version)
  expect(resolve).toHaveBeenCalledExactlyOnceWith({ session })
  expect(write).toHaveBeenCalledWith(expect.anything(), content, { kind: 'replaceIfVersion', version: before.version }, expect.any(AbortSignal), { mode: 'workspace-write', workspaceRoot: harness.workspace })
  expect(stat).not.toHaveBeenCalled()
  expect((await service.stat(harness.scope, 'file.txt', signal())).version).toBe(result.version)
})

it('rejects stale and competing saves without overwriting the winning content', async () => {
  const service = harness.endpoint()
  const { version } = await service.stat(harness.scope, 'file.txt', signal())
  const results = await Promise.allSettled([
    service.writeText(session, 'file.txt', 'one', version, signal()),
    service.writeText(session, 'file.txt', 'two', version, signal()),
  ])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  const loser = results.find(result => result.status === 'rejected')
  if (loser?.status !== 'rejected') throw new Error('one competing save must reject')
  expect(loser.reason).toMatchObject({ code: 'workspace-file/stale-version' })
  const current = await readFile(join(harness.workspace, 'file.txt'), 'utf8')
  expect(await failureOf(service.writeText(session, 'file.txt', 'stale', version, signal())))
    .toMatchObject({ code: 'workspace-file/stale-version' })
  expect(await readFile(join(harness.workspace, 'file.txt'), 'utf8')).toBe(current)
})

it.each([{ maxBytes: 3, maxFileBytes: 10 }, { maxBytes: 10, maxFileBytes: 3 }])('applies both byte caps to multibyte replacement text: %j', async (caps) => {
  const service = harness.endpoint(caps)
  const { version } = await service.stat(harness.scope, 'file.txt', signal())
  expect(await failureOf(service.writeText(session, 'file.txt', 'éé', version, signal())))
    .toMatchObject({ code: 'workspace-file/too-large', details: { limit: 3 } })
  expect(await readFile(join(harness.workspace, 'file.txt'), 'utf8')).toBe('original\r\n')
  expect(await service.writeText(session, 'file.txt', 'éa', version, signal())).toMatchObject({ bytes: 3 })
})

it('refuses outside files, final links, directories, missing files, NUL text, and empty versions', async () => {
  const service = harness.endpoint()
  const outside = join(harness.outside, 'file.txt')
  await writeFile(outside, 'outside')
  const { version } = await service.stat(harness.scope, 'file.txt', signal())
  for (const [path, text, expected, code] of [
    [outside, 'x', version, 'outside-workspace'],
    [harness.workspace, 'x', version, 'not-regular-file'],
    ['absent', 'x', version, 'not-found'],
    ['file.txt', '\0', version, 'not-text'],
  ]) {
    expect(await failureOf(service.writeText(session, path!, text!, expected!, signal())))
      .toMatchObject({ code: `workspace-file/${code}` })
  }
  expect(await failureOf(service.writeText(session, 'file.txt', 'x', '', signal()))).toMatchObject({ code: 'gateway/bad-request' })
  await symlink(harness.outside, join(harness.workspace, 'escape'), 'junction')
  expect(await failureOf(service.writeText(session, 'escape/file.txt', 'x', version, signal()))).toMatchObject({ code: 'workspace-file/outside-workspace' })
  // Directory junctions exercise final-link rejection without Windows symlink privileges.
  expect(await failureOf(service.writeText(session, 'escape', 'x', version, signal()))).toMatchObject({ code: 'workspace-file/not-regular-file' })
  expect(await readFile(outside, 'utf8')).toBe('outside')
  expect(await readFile(join(harness.workspace, 'file.txt'), 'utf8')).toBe('original\r\n')
})

it('denies a read-only Session even when the filesystem provider itself is unrestricted', async () => {
  const service = harness.endpoint()
  vi.spyOn(harness.ctx.sandboxPolicy, 'resolve').mockReturnValue({ mode: 'read-only', workspaceRoot: harness.workspace })
  const write = vi.spyOn(harness.ctx.fs, 'writeText')
  expect(await failureOf(service.writeText(session, 'file.txt', 'blocked', 'version', signal()))).toMatchObject({ code: 'workspace-file/write-denied' })
  expect(write).not.toHaveBeenCalled()
  expect(await readFile(join(harness.workspace, 'file.txt'), 'utf8')).toBe('original\r\n')
})

it('preserves contents on pre-publication cancellation and reports typed backend failures', async () => {
  const service = harness.endpoint()
  const { version } = await service.stat(harness.scope, 'file.txt', signal())
  expect(await failureOf(service.writeText(session, 'file.txt', 'x', version, AbortSignal.abort())))
    .toMatchObject({ code: 'workspace-file/aborted' })
  const write = vi.spyOn(harness.ctx.fs, 'writeText')
  for (const [fsCode, code] of [
    ['FS_PERMISSION_DENIED', 'write-denied'], ['FS_SANDBOX_DENIED', 'write-denied'],
    ['FS_NOT_REGULAR_FILE', 'not-regular-file'], ['FS_NOT_FOUND', 'not-found'],
    ['FS_ABORTED', 'aborted'], ['FS_IO_ERROR', 'write-failed'],
  ] as const) {
    write.mockRejectedValueOnce(new FsError('backend failure', fsCode))
    expect(await failureOf(service.writeText(session, 'file.txt', 'x', version, signal())))
      .toMatchObject({ code: `workspace-file/${code}` })
  }
  expect(await readFile(join(harness.workspace, 'file.txt'), 'utf8')).toBe('original\r\n')
})
