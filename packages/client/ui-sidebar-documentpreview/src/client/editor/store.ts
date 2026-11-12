/** Session-owned editing drafts survive file tab closure and renderer replacement. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** One complete UTF-8 document and its conditional-save base. */
export interface EditorDraft {
  text: string
  original: string
  version: string
  bom: boolean
  eol: '\n' | '\r\n'
  saving: boolean
  failure?: 'conflict' | 'unknown' | 'denied' | 'failed'
}

/** Drafts are keyed by complete resource address, including the addressed Session. */
export interface EditorState { drafts: Record<string, EditorDraft> }
type EditorActions = {
  loaded: (state: EditorState, address: string, draft: EditorDraft) => void
  changed: (state: EditorState, address: string, text: string) => void
  saving: (state: EditorState, address: string) => void
  saved: (state: EditorState, address: string, text: string, version: string) => void
  failed: (state: EditorState, address: string, failure: NonNullable<EditorDraft['failure']>) => void
  discard: (state: EditorState, address: string) => void
}

/** Declare Session-scoped drafts retained after tab closure. @returns the draft store declaration. */
export function createEditorStore(): EngineStoreHandle<EditorState, EditorActions> {
  return defineStore({
    init: (): EditorState => ({ drafts: {} }),
    actions: {
      loaded(state, address: string, draft: EditorDraft) {
        const current = state.drafts[address]
        if (current === undefined || (current.text === current.original && !current.saving)) state.drafts[address] = draft
      },
      changed(state, address: string, text: string) {
        const draft = state.drafts[address]
        if (draft !== undefined) draft.text = text
      },
      saving(state, address: string) {
        const draft = state.drafts[address]
        if (draft !== undefined) { draft.saving = true; delete draft.failure }
      },
      saved(state, address: string, text: string, version: string) {
        const draft = state.drafts[address]
        if (draft !== undefined) { draft.original = text; draft.version = version; draft.saving = false; delete draft.failure }
      },
      failed(state, address: string, failure: NonNullable<EditorDraft['failure']>) {
        const draft = state.drafts[address]
        if (draft !== undefined) { draft.saving = false; draft.failure = failure }
      },
      discard(state, address: string) {
        const { [address]: _discarded, ...remaining } = state.drafts
        state.drafts = remaining
      },
    },
  })
}

/** Store declaration shared by the editor body and its save actions. */
export type EditorStore = ReturnType<typeof createEditorStore>
