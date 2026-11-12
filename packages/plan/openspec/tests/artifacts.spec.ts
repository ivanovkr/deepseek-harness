/** Review identities reject linked artifacts and bound the complete Unicode review. */
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { artifactPath, changeName, snapshotArtifacts, writableArtifact } from '../src/artifacts.ts'

const roots: string[] = []
const limits = { maxArtifactBytes: 10000, maxArtifactFiles: 20 }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function project() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-openspec-'))
  roots.push(root)
  const base = join(root, 'openspec/changes/feature')
  mkdirSync(join(base, 'specs/feature'), { recursive: true })
  for (const path of ['proposal.md', 'design.md', 'specs/feature/spec.md']) writeFileSync(join(base, path), '# Required document\n')
  writeFileSync(join(base, 'tasks.md'), '- [ ] Implement the feature\n')
  return { root, base }
}
describe('reviewed OpenSpec artifacts', () => {
  it('binds the complete documents but not task checkbox completion', () => {
    const { root, base } = project()
    const before = snapshotArtifacts(root, 'feature', limits)
    expect(before.detail).toContain('Implement the feature')
    writeFileSync(join(base, 'tasks.md'), '- [x] Implement the feature\n')
    expect(snapshotArtifacts(root, 'feature', limits).digest).toBe(before.digest)
    writeFileSync(join(base, 'tasks.md'), '- [ ] Implement another feature\n')
    expect(snapshotArtifacts(root, 'feature', limits).digest).not.toBe(before.digest)
  })
  it('rejects absent requirements and empty documents', () => {
    const { root, base } = project()
    writeFileSync(join(base, 'design.md'), '')
    expect(() => snapshotArtifacts(root, 'feature', limits)).toThrow('empty')
    writeFileSync(join(base, 'design.md'), '# Design')
    rmSync(join(base, 'specs'), { recursive: true })
    expect(() => snapshotArtifacts(root, 'feature', limits)).toThrow('requirements')
  })
  it('bounds the complete reviewed result and file count', () => {
    const { root } = project()
    expect(() => snapshotArtifacts(root, 'feature', { ...limits, maxArtifactBytes: 20 })).toThrow('byte limit')
    expect(() => snapshotArtifacts(root, 'feature', { ...limits, maxArtifactFiles: 2 })).toThrow('limit')
    expect(snapshotArtifacts(root, 'feature', { ...limits, maxArtifactFiles: 7 }).detail).not.toBe('')
    expect(() => snapshotArtifacts(root, 'feature', { ...limits, maxArtifactFiles: 6 })).toThrow('limit')
  })
  it('includes change metadata and root configuration in the reviewed identity', () => {
    const { root, base } = project()
    const initial = snapshotArtifacts(root, 'feature', limits)
    writeFileSync(join(base, '.openspec.yaml'), 'schema: spec-driven\n')
    const withMetadata = snapshotArtifacts(root, 'feature', limits)
    expect(withMetadata.digest).not.toBe(initial.digest)
    writeFileSync(join(root, 'openspec/config.yaml'), 'schema: spec-driven\n')
    const withConfiguration = snapshotArtifacts(root, 'feature', limits)
    expect(withConfiguration.digest).not.toBe(withMetadata.digest)
    expect(withConfiguration.detail).toContain('openspec/config.yaml')
  })
  it('counts every separator and Unicode byte at the inclusive review limit', () => {
    const { root, base } = project()
    writeFileSync(join(base, 'design.md'), '# Дизайн 界\n')
    const initial = snapshotArtifacts(root, 'feature', limits)
    const size = Buffer.byteLength(initial.detail)
    expect(snapshotArtifacts(root, 'feature', { ...limits, maxArtifactBytes: size }).detail).toBe(initial.detail)
    expect(() => snapshotArtifacts(root, 'feature', { ...limits, maxArtifactBytes: size - 1 })).toThrow('byte limit')
  })
  it('rejects a linked capability directory before reading its target', () => {
    const { root, base } = project()
    const target = join(root, 'outside-change')
    mkdirSync(target)
    writeFileSync(join(target, 'spec.md'), '# Not part of the selected change\n')
    const capability = join(base, 'specs/feature')
    rmSync(capability, { recursive: true })
    symlinkSync(target, capability, 'junction')
    expect(() => snapshotArtifacts(root, 'feature', limits)).toThrow('symlink')
    expect(() => artifactPath(root, 'openspec/changes/feature/specs/feature/spec.md')).toThrow('symlink')
  })
  it('rejects traversal and non-planning writes', () => {
    for (const path of ['../outside', '/outside', 'specs/../tasks.md', 'src/index.ts']) expect(() => writableArtifact(path)).toThrow()
    for (const change of ['../feature', '--help', 'Feature', 'a/b']) expect(() => changeName(change)).toThrow()
    expect(() => artifactPath('/project', 'openspec/../outside')).toThrow()
    expect(writableArtifact('specs/feature/spec.md')).toBe('specs/feature/spec.md')
  })
})
