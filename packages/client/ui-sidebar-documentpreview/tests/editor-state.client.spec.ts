/** Editing preserves source bytes and retains drafts independently of tab visibility. */
import { expect, it } from 'vitest'
import { createEditorStore } from '../src/client/editor/store.ts'
import { decodeEditorText, encodeEditorText } from '../src/client/editor/text.ts'

it.each(['hello\n', '\ufeffПривет\r\nsecond\r\n', '', 'last line'])('round-trips UTF-8 without silently changing BOM, terminators, or final newline: %j', (text) => {
  const draft = decodeEditorText(new TextEncoder().encode(text), 'v1')
  expect(draft).toBeDefined()
  expect(encodeEditorText(draft!)).toBe(text)
})

it.each([new Uint8Array([255]), new TextEncoder().encode('a\0b'), new TextEncoder().encode('a\r\nb\n'), new TextEncoder().encode('a\rb')])('refuses unsupported encoding and line endings', (data) => {
  expect(decodeEditorText(data, 'v1')).toBeUndefined()
})

it('retains dirty text on invalidation, records the version of the submitted save, and keeps edits typed during saving', () => {
  const store = createEditorStore().create()
  const draft = decodeEditorText(new TextEncoder().encode('original\n'), 'v1')!
  store.actions.loaded('file', draft)
  store.actions.changed('file', 'edit\n')
  store.actions.loaded('file', { ...draft, text: 'external', original: 'external', version: 'v2' })
  expect(store.getSnapshot().drafts.file?.text).toBe('edit\n')
  store.actions.saving('file')
  store.actions.changed('file', 'another edit\n')
  store.actions.saved('file', 'edit\n', 'v3')
  expect(store.getSnapshot().drafts.file).toMatchObject({ text: 'another edit\n', original: 'edit\n', version: 'v3', saving: false })
  store.actions.failed('file', 'conflict')
  expect(store.getSnapshot().drafts.file?.text).toBe('another edit\n')
  store.actions.discard('file')
  expect(store.getSnapshot().drafts.file).toBeUndefined()
})

it('isolates Session-owned drafts and addresses', () => {
  const handle = createEditorStore()
  const first = handle.create()
  const second = handle.create()
  first.actions.loaded('file', decodeEditorText(new Uint8Array(), 'v1')!)
  expect(second.getSnapshot().drafts).toEqual({})
  first.actions.changed('absent', 'ignored')
  first.actions.saving('absent')
  first.actions.saved('absent', '', 'v2')
  first.actions.failed('absent', 'failed')
  expect(first.getSnapshot().drafts.absent).toBeUndefined()
})
