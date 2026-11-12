/** Lossless UTF-8 editing, refusing mixed line endings rather than normalizing them silently. */
import type { EditorDraft } from './store.ts'

/**
 * Decode a lossless editable document.
 * @param data - complete file bytes.
 * @param version - verified source version.
 * @returns editable text or undefined for unsupported encoding or line endings.
 */
export function decodeEditorText(data: Uint8Array, version: string): EditorDraft | undefined {
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data) }
  catch (_error) { /* Invalid UTF-8 cannot be edited losslessly. */ return undefined }
  if (text.includes('\0')) return undefined
  const bom = text.startsWith('\ufeff')
  if (bom) text = text.slice(1)
  const crlf = text.includes('\r\n')
  const withoutPairs = text.replaceAll('\r\n', '')
  if (withoutPairs.includes('\r') || (crlf && withoutPairs.includes('\n'))) return undefined
  const eol = crlf ? '\r\n' : '\n'
  text = text.replaceAll('\r\n', '\n')
  return { text, original: text, version, bom, eol, saving: false }
}

/**
 * Restore the source BOM and newline convention.
 * @param draft - editor text and original encoding metadata.
 * @returns UTF-8 text preserving the BOM and original newline convention.
 */
export function encodeEditorText(draft: EditorDraft): string {
  return (draft.bom ? '\ufeff' : '') + draft.text.replaceAll('\r\n', '\n').replaceAll('\n', draft.eol)
}
