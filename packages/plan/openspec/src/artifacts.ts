/** Bounded local OpenSpec artifact inspection and review identities. */
import { createHash } from 'node:crypto'
import { closeSync, existsSync, lstatSync, openSync, opendirSync, readSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { HarnessError } from '@deepseek-ai/dsh-llm'

/** Deployment limits for the complete artifact set, including review metadata. */
export interface ArtifactLimits {
  readonly maxArtifactBytes: number
  readonly maxArtifactFiles: number
}

/** The exact bounded documents offered for human review. */
export interface ArtifactSnapshot {
  readonly root: string
  readonly digest: string
  readonly detail: string
}

/**
 * Reject a change identifier that could name a path or CLI option.
 * @param change - model-supplied identifier.
 * @returns the validated identifier.
 */
export function changeName(change: string): string {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(change)) {
    throw new HarnessError('OpenSpec change must be a lowercase kebab-case identifier.', 'OPENSPEC_INVALID_CHANGE')
  }
  return change
}

/**
 * Resolve a project-relative path without following any existing symlink component.
 * @param root - canonical local project directory.
 * @param path - slash-separated project-relative path without dot components.
 * @returns the intended absolute path, including when its suffix does not exist.
 */
export function artifactPath(root: string, path: string): string {
  const parts = path.split('/')
  if (parts.some(part => !/^[a-zA-Z0-9_.-]+$/.test(part) || part === '.' || part === '..')) {
    throw new HarnessError('OpenSpec artifact path must stay inside the selected change.', 'OPENSPEC_INVALID_PATH')
  }
  let current = root
  for (const part of parts) {
    current = join(current, part)
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new HarnessError(`OpenSpec refuses a symlink in its artifact path: ${current}`, 'OPENSPEC_INVALID_PATH')
    }
  }
  return current
}

/**
 * Admit only the planning documents writable before human approval.
 * @param artifact - path relative to the selected change.
 * @returns the validated relative path.
 */
export function writableArtifact(artifact: string): string {
  if (!/^(?:proposal\.md|design\.md|tasks\.md|specs\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/spec\.md)$/.test(artifact)) {
    throw new HarnessError('Write proposal.md, design.md, tasks.md, or specs/<capability>/spec.md through OpenSpec.', 'OPENSPEC_INVALID_PATH')
  }
  return artifact
}

/**
 * Read all reviewed artifacts and schema configuration, rejecting incomplete or oversized plans.
 * Task checkbox completion is excluded from the authorization digest, not from displayed content.
 * @param directory - effective local project directory.
 * @param change - selected change identifier.
 * @param limits - complete review file and byte bounds.
 * @returns canonical project identity, content digest, and the exact review documents.
 */
export function snapshotArtifacts(directory: string, change: string, limits: ArtifactLimits): ArtifactSnapshot {
  const root = realpathSync(resolve(directory))
  const base = `openspec/changes/${changeName(change)}`
  const changeRoot = artifactPath(root, base)
  const paths: string[] = []
  let entries = 0
  const countEntry = (): void => {
    entries += 1
    if (entries > limits.maxArtifactFiles) throw new HarnessError('OpenSpec artifact file and directory limit exceeded.', 'OPENSPEC_ARTIFACT_LIMIT')
  }
  const visit = (relative: string): void => {
    countEntry()
    const directoryHandle = opendirSync(artifactPath(root, relative))
    try {
      for (let entry = directoryHandle.readSync(); entry !== null; entry = directoryHandle.readSync()) {
        const child = `${relative}/${entry.name}`
        const path = artifactPath(root, child)
        const info = lstatSync(path)
        if (info.isDirectory()) visit(child)
        else if (info.isFile()) {
          countEntry()
          paths.push(child)
        } else throw new HarnessError(`OpenSpec artifact is not a regular file: ${path}`, 'OPENSPEC_INVALID_PATH')
      }
    } finally {
      directoryHandle.closeSync()
    }
  }
  if (!lstatSync(changeRoot).isDirectory()) throw new HarnessError('OpenSpec change directory is missing.', 'OPENSPEC_INCOMPLETE')
  visit(base)
  for (const file of ['proposal.md', 'design.md', 'tasks.md']) {
    if (!paths.includes(`${base}/${file}`)) throw new HarnessError(`OpenSpec review requires ${file}.`, 'OPENSPEC_INCOMPLETE')
  }
  if (!paths.some(path => path.startsWith(`${base}/specs/`) && path.endsWith('/spec.md'))) {
    throw new HarnessError('OpenSpec review requires at least one requirements spec.', 'OPENSPEC_INCOMPLETE')
  }
  const configuration = artifactPath(root, 'openspec/config.yaml')
  if (existsSync(configuration)) {
    countEntry()
    paths.push('openspec/config.yaml')
  }
  const hash = createHash('sha256')
  const documents: string[] = []
  let bytes = 0
  for (const path of paths.sort()) {
    const absolute = artifactPath(root, path)
    if (!lstatSync(absolute).isFile()) throw new HarnessError(`OpenSpec artifact is not a regular file: ${absolute}`, 'OPENSPEC_INVALID_PATH')
    const buffer = Buffer.alloc(limits.maxArtifactBytes - bytes + 1)
    const fd = openSync(absolute, 'r')
    let length = 0
    try {
      while (length < buffer.length) {
        const count = readSync(fd, buffer, length, buffer.length - length, null)
        if (count === 0) break
        length += count
      }
    } finally {
      closeSync(fd)
    }
    const content = buffer.subarray(0, length).toString('utf8')
    const document = `## ${path}\n\n${content}\n`
    bytes += Buffer.byteLength(document) + (documents.length === 0 ? 0 : 1)
    if (bytes > limits.maxArtifactBytes) throw new HarnessError('OpenSpec review byte limit exceeded.', 'OPENSPEC_ARTIFACT_LIMIT')
    if (content.trim() === '') throw new HarnessError(`OpenSpec review document is empty: ${path}`, 'OPENSPEC_INCOMPLETE')
    const identityContent = path === `${base}/tasks.md` ? content.replace(/^(\s*-\s+)\[[xX ]\]/gm, '$1[ ]') : content
    hash.update(JSON.stringify([path, identityContent]))
    documents.push(document)
  }
  return { root, digest: hash.digest('hex'), detail: documents.join('\n') }
}
