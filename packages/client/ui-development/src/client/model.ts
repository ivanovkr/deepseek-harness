/** File-derived OpenSpec artifacts; never an OpenSpec CLI workflow status. */
export type ArtifactKind = 'proposal' | 'specs' | 'design' | 'tasks'

/** Standard artifact categories in display order. */
export const artifactKinds: readonly ArtifactKind[] = ['proposal', 'specs', 'design', 'tasks']

/** One discovered file, rooted in openspec/changes. */
export interface ArtifactFile { readonly kind: ArtifactKind; readonly path: string }

/** A change and the standard documents found during one directory scan. */
export interface Change { readonly id: string; readonly files: readonly ArtifactFile[] }

/** Complete bounded directory scan, or an absent OpenSpec directory. */
export interface Board { readonly changes: readonly Change[]; readonly missing: boolean }

/** One complete, version-consistent text document. */
export interface Document { readonly path: string; readonly text: string }

/** Task syntax recorded in Markdown, not execution evidence. */
export interface Task { readonly line: number; readonly text: string; readonly checked: boolean }

/** Count distinct document categories, not files or completed work.
 * @param change - Discovered files.
 * @returns Category count from zero through four.
 */
export function documentCount(change: Change): number { return new Set(change.files.map(file => file.kind)).size }

/** Extract checkboxes outside fenced examples; preserve line identity.
 * @param markdown - Complete tasks document.
 * @returns Read-only task records in source order.
 */
export function parseTasks(markdown: string): readonly Task[] {
  const tasks: Task[] = []
  let fence: { marker: string; length: number } | undefined
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (delimiter) {
      const run = delimiter[1]!
      if (!fence) fence = { marker: run[0]!, length: run.length }
      else if (run[0] === fence.marker && run.length >= fence.length && delimiter[2]!.trim() === '') fence = undefined
      continue
    }
    if (fence) continue
    const task = /^\s*(?:[-+*]|\d+[.)])\s+\[([ xX])\]\s+(.+)$/.exec(line)
    if (task) tasks.push({ line: index + 1, checked: task[1]!.toLowerCase() === 'x', text: task[2]! })
  }
  return tasks
}
