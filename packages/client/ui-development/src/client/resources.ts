/** Bounded, manually refreshed OpenSpec file resources over workspaceFiles. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-workspace-files/client'
import type { ResourceProvider } from '@deepseek-ai/dsh-client-resources/client'
import { RemoteError, remoteErrorOf, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Config } from './config.ts'
import type { ArtifactFile, Board, Change, Document } from './model.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap {
    'development-board': Board
    'development-document': Document
  }
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'development/invalid-address': Record<string, never>
    'development/limit': Record<string, never>
    'development/changed': Record<string, never>
    'development/read-failed': Record<string, never>
  }
}

type Files = Pick<Context['remote']['workspaceFiles'], 'list' | 'read'>
const root = 'openspec/changes'
const segment = (value: string): boolean => value !== '' && value !== '.' && value !== '..' && !/[\\/:\u0000]/.test(value)

/** Address one Session's directory scan without allocating refresh records.
 * @param sessionId - Authorizing Session.
 * @returns Stable resource URL.
 */
export function boardAddress(sessionId: SessionId): string { return `dsh-resource://development-board/${encodeURIComponent(sessionId)}` }

/** Address one discovered standard artifact.
 * @param sessionId - Authorizing Session.
 * @param path - Relative discovered file path.
 * @returns Stable resource URL.
 */
export function documentAddress(sessionId: SessionId, path: string): string {
  return `dsh-resource://development-document/${encodeURIComponent(sessionId)}/${path.split('/').map(encodeURIComponent).join('/')}`
}

function parseAddress(address: string, protocol: string): { sessionId: SessionId; path: string } {
  let url: URL
  try { url = new URL(address) } catch (cause) {
    throw new RemoteError('development/invalid-address', 'Invalid resource URL.', {}, { cause })
  }
  if (url.protocol !== 'dsh-resource:' || url.hostname !== protocol || url.search || url.hash) throw new RemoteError('development/invalid-address', 'Invalid resource URL.', {})
  let parts: string[]
  try { parts = url.pathname.slice(1).split('/').map(decodeURIComponent) } catch (cause) {
    throw new RemoteError('development/invalid-address', 'Invalid resource encoding.', {}, { cause })
  }
  if (!parts.every(segment)) throw new RemoteError('development/invalid-address', 'Invalid resource path.', {})
  const sessionId = parts.shift()! as SessionId
  const path = parts.join('/')
  if (protocol === 'development-board' ? parts.length !== 0 : !/^openspec\/changes\/[^/]+\/(?:proposal\.md|design\.md|tasks\.md|specs\/[^/]+\/spec\.md)$/.test(path) || parts[2] === 'archive') {
    throw new RemoteError('development/invalid-address', 'Not a standard active-change artifact.', {})
  }
  return { sessionId, path }
}

function limit(): never { throw new RemoteError('development/limit', 'The configured read budget was exceeded; no partial result is shown.', {}) }

async function scan(files: Files, sessionId: SessionId, config: Config, signal: AbortSignal): Promise<Board> {
  const listed = await files.list(sessionId, root, signal)
  signal.throwIfAborted()
  if (!listed.ok) {
    if (listed.error.code === 'workspace-file/not-found') return { changes: [], missing: true }
    throw listed.error
  }
  if (listed.value.truncated) limit()
  const dirs = listed.value.entries.filter(entry => entry.type === 'directory' && entry.name !== 'archive')
  if (dirs.length > config.maxChanges) limit()
  const changes: Change[] = []
  for (const dir of dirs) {
    if (!segment(dir.name)) throw new RemoteError('development/invalid-address', 'Invalid change directory.', {})
    const base = `${root}/${dir.name}`
    const listing = await files.list(sessionId, base, signal)
    signal.throwIfAborted()
    if (!listing.ok) throw listing.error
    if (listing.value.truncated) limit()
    const artifacts: ArtifactFile[] = []
    for (const kind of ['proposal', 'design', 'tasks'] as const) {
      if (listing.value.entries.some(entry => entry.name === `${kind}.md` && entry.type === 'file')) artifacts.push({ kind, path: `${base}/${kind}.md` })
    }
    if (listing.value.entries.some(entry => entry.name === 'specs' && entry.type === 'directory')) {
      const specs = await files.list(sessionId, `${base}/specs`, signal)
      signal.throwIfAborted()
      if (!specs.ok) throw specs.error
      if (specs.value.truncated || specs.value.entries.length > config.maxSpecFiles) limit()
      for (const spec of specs.value.entries.filter(entry => entry.type === 'directory')) {
        if (!segment(spec.name)) throw new RemoteError('development/invalid-address', 'Invalid specification directory.', {})
        const specPath = `${base}/specs/${spec.name}`
        const contents = await files.list(sessionId, specPath, signal)
        signal.throwIfAborted()
        if (!contents.ok) throw contents.error
        if (contents.value.truncated) limit()
        if (contents.value.entries.some(entry => entry.name === 'spec.md' && entry.type === 'file')) artifacts.push({ kind: 'specs', path: `${specPath}/spec.md` })
      }
    }
    changes.push({ id: dir.name, files: artifacts })
  }
  return { changes: changes.sort((a, b) => a.id.localeCompare(b.id)), missing: false }
}

async function readDocument(files: Files, sessionId: SessionId, path: string, config: Config, signal: AbortSignal): Promise<Document> {
  const chunks: string[] = []
  let offset = 1
  let version: string | undefined
  let bytes = 0
  for (let page = 0; page < config.maxDocumentPages; page++) {
    const result = await files.read(sessionId, path, { offset }, signal)
    signal.throwIfAborted()
    if (!result.ok) throw result.error
    const value = result.value
    if (version !== undefined && value.version !== version) throw new RemoteError('development/changed', 'The file changed during reading. Refresh to retry.', {})
    version = value.version
    bytes += new TextEncoder().encode(value.text).byteLength + (chunks.length ? 1 : 0)
    if (bytes > config.maxDocumentBytes) limit()
    chunks.push(value.text)
    if (value.eof) return { path, text: chunks.join('\n') }
    if (value.lines === 0) throw new RemoteError('development/changed', 'The read did not advance. Refresh to retry.', {})
    offset += value.lines
  }
  return limit()
}

/** Create an instance-local refresh owner; resources release every listener on abort.
 * @param files - Existing generated workspace file methods.
 * @param config - Validated read budgets.
 * @returns Providers and a coalescing, read-only Session refresh callback.
 */
export function createDevelopmentResources(files: Files, config: Config) {
  const listeners = new Map<SessionId, Set<() => void>>()
  async function* observe<T>(address: string, protocol: string, signal: AbortSignal, load: (sessionId: SessionId, path: string) => Promise<T>): AsyncIterable<RemoteResult<T>> {
    if (signal.aborted) return
    let target: ReturnType<typeof parseAddress>
    try { target = parseAddress(address, protocol) } catch (error) {
      yield { ok: false, error: remoteErrorOf(error) ?? new RemoteError('development/read-failed', String(error), {}, { cause: error }) }
      return
    }
    let dirty = true
    let wake: (() => void) | undefined
    const refresh = (): void => { dirty = true; wake?.() }
    const abort = (): void => { wake?.() }
    const set = listeners.get(target.sessionId) ?? new Set<() => void>()
    listeners.set(target.sessionId, set)
    set.add(refresh)
    signal.addEventListener('abort', abort, { once: true })
    try {
      while (!signal.aborted) {
        if (!dirty) await new Promise<void>(resolve => { wake = resolve; if (signal.aborted || dirty) resolve() })
        wake = undefined
        if (signal.aborted) return
        dirty = false
        try {
          const value = await load(target.sessionId, target.path)
          if (!signal.aborted) yield { ok: true, value }
        } catch (error) {
          if (!signal.aborted) yield { ok: false, error: remoteErrorOf(error) ?? new RemoteError('development/read-failed', error instanceof Error ? error.message : String(error), {}, { cause: error }) }
        }
      }
    } finally {
      signal.removeEventListener('abort', abort)
      set.delete(refresh)
      if (set.size === 0) listeners.delete(target.sessionId)
    }
  }
  const board: ResourceProvider<'development-board'> = {
    protocol: 'development-board',
    open: (address, { signal }) => observe(address, 'development-board', signal, sessionId => scan(files, sessionId, config, signal)),
  }
  const document: ResourceProvider<'development-document'> = {
    protocol: 'development-document',
    open: (address, { signal }) => observe(address, 'development-document', signal, (sessionId, path) => readDocument(files, sessionId, path, config, signal)),
  }
  return { board, document, refresh: (sessionId: SessionId): void => { for (const notify of listeners.get(sessionId) ?? []) notify() } }
}
