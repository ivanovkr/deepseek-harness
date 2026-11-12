import { describe, expect, it, vi } from 'vitest'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { boardAddress, createDevelopmentResources, documentAddress } from '../src/client/resources.ts'
import { documentCount, parseTasks } from '../src/client/model.ts'

type Files = Parameters<typeof createDevelopmentResources>[0]
const session = 'session' as SessionId
const config = { maxChanges: 3, maxSpecFiles: 3, maxDocumentBytes: 100, maxDocumentPages: 3 }
function setup() {
  const list = vi.fn<Files['list']>(async (_session, path) => ({ ok: true, value: { path, entries: [], truncated: false } }))
  const read = vi.fn<Files['read']>(async (_session, path) => ({ ok: true, value: { absolutePath: path, version: 'v1', offset: 1, text: '# Proposal', lines: 1, eof: true } }))
  return { list, read, resources: createDevelopmentResources({ list, read }, config) }
}

describe('development resources', () => {
  it('distinguishes absent directories and retries failures on the same address', async () => {
    const b = setup()
    b.list.mockResolvedValueOnce({ ok: false, error: new RemoteError('workspace-file/not-found', 'absent', { path: 'openspec/changes' }) })
    const controller = new AbortController()
    const stream = b.resources.board.open(boardAddress(session), { signal: controller.signal })[Symbol.asyncIterator]()
    try {
      expect(await stream.next()).toMatchObject({ value: { ok: true, value: { changes: [], missing: true } } })
      const error = new RemoteError('development/read-failed', 'permission denied', {})
      b.list.mockResolvedValueOnce({ ok: false, error })
      b.resources.refresh(session)
      expect(await stream.next()).toMatchObject({ value: { ok: false, error } })
      b.resources.refresh(session)
      expect(await stream.next()).toMatchObject({ value: { ok: true, value: { missing: false } } })
    } finally { controller.abort(); await stream.return?.() }
    b.resources.refresh(session)
    expect(b.list).toHaveBeenCalledTimes(3)
  })
  it('discovers standard files and excludes archived changes', async () => {
    const b = setup()
    b.list.mockResolvedValueOnce({ ok: true, value: { path: 'openspec/changes', truncated: false, entries: [{ name: 'archive', type: 'directory' }, { name: 'feature', type: 'directory' }] } })
    b.list.mockResolvedValueOnce({ ok: true, value: { path: 'openspec/changes/feature', truncated: false, entries: [{ name: 'proposal.md', type: 'file' }, { name: 'tasks.md', type: 'file' }, { name: 'specs', type: 'directory' }] } })
    b.list.mockResolvedValueOnce({ ok: true, value: { path: 'openspec/changes/feature/specs', truncated: false, entries: [{ name: 'api', type: 'directory' }] } })
    b.list.mockResolvedValueOnce({ ok: true, value: { path: 'openspec/changes/feature/specs/api', truncated: false, entries: [{ name: 'spec.md', type: 'file' }] } })
    const controller = new AbortController()
    const stream = b.resources.board.open(boardAddress(session), { signal: controller.signal })[Symbol.asyncIterator]()
    try {
      expect(await stream.next()).toMatchObject({ value: { ok: true, value: { changes: [{ id: 'feature', files: [{ kind: 'proposal' }, { kind: 'tasks' }, { kind: 'specs' }] }] } } })
      expect(b.read).not.toHaveBeenCalled()
    } finally { controller.abort(); await stream.return?.() }
  })
  it('rejects truncated discovery rather than showing a misleading partial board', async () => {
    const b = setup()
    b.list.mockResolvedValueOnce({ ok: true, value: { path: '', entries: [], truncated: true } })
    const controller = new AbortController()
    const stream = b.resources.board.open(boardAddress(session), { signal: controller.signal })[Symbol.asyncIterator]()
    try { expect(await stream.next()).toMatchObject({ value: { ok: false, error: { code: 'development/limit' } } }) }
    finally { controller.abort(); await stream.return?.() }
  })
  it('rejects nonstandard paths before any reads', async () => {
    const b = setup()
    for (const path of ['openspec/changes/archive/tasks.md', 'openspec/changes/a/secrets.txt', 'openspec/changes/a/specs/x/../../private.md']) {
      const stream = b.resources.document.open(documentAddress(session, path), { signal: new AbortController().signal })[Symbol.asyncIterator]()
      expect(await stream.next()).toMatchObject({ value: { ok: false, error: { code: 'development/invalid-address' } } })
      await stream.return?.()
    }
    expect(b.read).not.toHaveBeenCalled()
  })
  it('paginates version-consistent text and bounds complete UTF-8 bytes', async () => {
    const b = setup()
    b.read.mockResolvedValueOnce({ ok: true, value: { absolutePath: '', version: 'v1', offset: 1, text: 'first', lines: 1, eof: false } })
    b.read.mockResolvedValueOnce({ ok: true, value: { absolutePath: '', version: 'v1', offset: 2, text: 'second', lines: 1, eof: true } })
    const controller = new AbortController()
    const stream = b.resources.document.open(documentAddress(session, 'openspec/changes/a/tasks.md'), { signal: controller.signal })[Symbol.asyncIterator]()
    try {
      expect(await stream.next()).toMatchObject({ value: { ok: true, value: { text: 'first\nsecond' } } })
      expect(b.read).toHaveBeenLastCalledWith(session, 'openspec/changes/a/tasks.md', { offset: 2 }, controller.signal)
      b.read.mockResolvedValueOnce({ ok: true, value: { absolutePath: '', version: 'v1', offset: 1, text: '界'.repeat(34), lines: 1, eof: true } })
      b.resources.refresh(session)
      expect(await stream.next()).toMatchObject({ value: { ok: false, error: { code: 'development/limit' } } })
    } finally { controller.abort(); await stream.return?.() }
  })
  it('does not publish mixed file versions', async () => {
    const b = setup()
    b.read.mockResolvedValueOnce({ ok: true, value: { absolutePath: '', version: 'v1', offset: 1, text: 'first', lines: 1, eof: false } })
    b.read.mockResolvedValueOnce({ ok: true, value: { absolutePath: '', version: 'v2', offset: 2, text: 'second', lines: 1, eof: true } })
    const controller = new AbortController()
    const stream = b.resources.document.open(documentAddress(session, 'openspec/changes/a/tasks.md'), { signal: controller.signal })[Symbol.asyncIterator]()
    try { expect(await stream.next()).toMatchObject({ value: { ok: false, error: { code: 'development/changed' } } }) }
    finally { controller.abort(); await stream.return?.() }
  })
  it('stops a pending refresh wait on disposal and performs no later reads', async () => {
    const b = setup()
    const controller = new AbortController()
    const stream = b.resources.board.open(boardAddress(session), { signal: controller.signal })[Symbol.asyncIterator]()
    await stream.next()
    const pending = stream.next()
    controller.abort()
    expect(await pending).toMatchObject({ done: true })
    b.resources.refresh(session)
    expect(b.list).toHaveBeenCalledOnce()
  })
  it('does not continue scanning when cancellation arrives during a read', async () => {
    const b = setup()
    const controller = new AbortController()
    b.list.mockImplementationOnce(async () => {
      controller.abort()
      return { ok: true, value: { path: '', truncated: false, entries: [{ name: 'feature', type: 'directory' }] } }
    })
    const stream = b.resources.board.open(boardAddress(session), { signal: controller.signal })[Symbol.asyncIterator]()
    expect(await stream.next()).toMatchObject({ done: true })
    expect(b.list).toHaveBeenCalledOnce()
  })
})

describe('document-derived summaries', () => {
  it('counts types, not spec files or completed workflow', () => {
    expect(documentCount({ id: 'a', files: [{ kind: 'specs', path: 'a' }, { kind: 'specs', path: 'b' }] })).toBe(1)
  })
  it('extracts source checkboxes but excludes fenced examples', () => {
    expect(parseTasks('- [x] first\n```md\n- [x] example\n```\n  - [ ] second\n~~~\n- [x] hidden\n~~~')).toEqual([
      { line: 1, checked: true, text: 'first' }, { line: 5, checked: false, text: 'second' },
    ])
  })
})
