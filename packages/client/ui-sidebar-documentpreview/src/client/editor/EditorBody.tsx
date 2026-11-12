/** Project editing with retained drafts, conditional saves, and workspace-tree navigation. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, languageForPath } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsStore, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { DocumentPreviewProps } from '../document/contract.ts'
import type { EditorInjected } from './index.ts'
import type { EditorStore } from './store.ts'
import css from './EditorBody.module.css'

/** Editor callbacks, retained drafts, and framework-owned theme and document seats. */
export type EditorBodyProps = DocumentPreviewProps & PropsLocale<'sidebarEditor'> & PropsStore<EditorStore> & InjectFace<EditorInjected & {
  hooks: { editorTheme: { getSnapshot: () => ThemeSnapshot; subscribe: (listener: () => void) => () => void } }
}>

/**
 * Render the source editor and save controls.
 * @param props - file resource, retained drafts, localized copy and authorized operations.
 * @returns a toolbar, status, and lazily mounted Monaco editor.
 */
export function EditorBody(props: EditorBodyProps): ReactNode {
  const { resourceAddress: address, actions, load, save, mount, guardDraft, confirmDiscard, t } = props
  const renderFactorySlot = props.renderFactorySlot
  const draft = props.useStore(state => state.drafts[address])
  const theme = props.useEditorTheme(value => value)
  const useTabInfo = props.useTabInfo
  const { tab } = useTabInfo()
  const request = props.content.kind === 'renderer' ? props.content : undefined
  const [failure, setFailure] = useState<'failed' | 'unsupported' | 'conflict'>()
  const [attempt, setAttempt] = useState(0)
  const [sourceVersion, setSourceVersion] = useState<string>()
  const [mounting, setMounting] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const current = useRef(draft)
  current.current = draft
  const dirty = draft !== undefined && draft.text !== draft.original
  const saveDraft = useCallback(() => {
    const value = current.current
    if (value === undefined || value.saving || value.text === value.original || value.failure === 'unknown' || value.failure === 'conflict') return
    actions.saving(address)
    void save(address, value, tab.signal).then((result) => {
      if ('failure' in result) actions.failed(address, result.failure)
      else {
        actions.saved(address, value.text, result.version)
        guardDraft(address, current.current?.text !== value.text)
      }
    }, (_error: unknown) => {
      // A lost response cannot establish whether the Host published the replacement.
      actions.failed(address, 'unknown')
    })
  }, [actions, address, save, tab.signal, guardDraft])
  const saveRef = useRef(saveDraft)
  saveRef.current = saveDraft
  useEffect(() => {
    if (request === undefined) return
    const retained = current.current
    if (retained !== undefined && (retained.text !== retained.original || retained.saving || retained.failure !== undefined)) {
      request.loaded(retained.version)
      return
    }
    const abort = new AbortController()
    const signal = AbortSignal.any([abort.signal, tab.signal])
    void load(address, signal).then((result) => {
      if (signal.aborted) return
      if (typeof result === 'string') { setFailure(result); request.failed(); return }
      const retained = current.current
      if (retained === undefined || retained.version !== result.version) setSourceVersion(result.version)
      actions.loaded(address, result)
      request.loaded(retained !== undefined && retained.text !== retained.original ? retained.version : result.version)
    }, (_error: unknown) => { if (!signal.aborted) { setFailure('failed'); request.failed() } })
    return () => { abort.abort() }
  }, [address, request?.revision, attempt, load, tab.signal])
  const ready = draft !== undefined
  useEffect(() => {
    const element = container.current
    const value = current.current
    if (element === null || value === undefined) return
    const abort = new AbortController()
    let dispose: (() => void) | undefined
    setMounting(true)
    void mount(element, {
      text: value.text, label: t('editorLabel'), language: languageForPath(address) ?? 'plaintext',
      wrap: props.wrap, dark: theme.active.colorScheme === 'dark', fontSize: theme.fontSizes.code,
      changed: (text) => {
        actions.changed(address, text)
        guardDraft(address, text !== current.current?.original)
      },
      save: () => { saveRef.current() },
    }, abort.signal).then((cleanup) => {
      if (abort.signal.aborted) cleanup()
      else { dispose = cleanup; setMounting(false) }
    }, (_error: unknown) => {
      if (!abort.signal.aborted) { setMounting(false); setFailure('failed') }
    })
    return () => { abort.abort(); dispose?.() }
  }, [address, ready, sourceVersion, mount, actions, guardDraft, props.wrap, theme.active.colorScheme, theme.fontSizes.code, t])
  const reload = (): void => {
    if ((dirty || draft?.failure === 'unknown') && !confirmDiscard()) return
    actions.discard(address)
    guardDraft(address, false)
    setFailure(undefined)
    setAttempt(value => value + 1)
    request?.reload()
  }
  const onOpen = useCallback((next: string): void => {
    if (next === address) return
    if (dirty && !confirmDiscard()) return
    tab.actions.openResource(next, { replaceTab: true })
  }, [address, dirty, confirmDiscard, tab.actions])
  return <section className={css.body} data-project-editor>
    <div className={css.toolbar}>
      <Button size="sm" onClick={saveDraft} disabled={!dirty || draft.saving || draft.failure === 'unknown' || draft.failure === 'conflict'}>{t(draft?.saving ? 'saving' : 'save')}</Button>
      <Button size="sm" variant="ghost" onClick={reload} disabled={draft?.saving}>{t(draft === undefined ? 'retry' : 'reload')}</Button>
      <span role="status">{t(draft?.saving ? 'saving' : mounting || draft === undefined ? 'loading' : dirty ? 'dirty' : 'saved')}</span>
    </div>
    {(draft?.failure ?? failure) !== undefined && <p className={css.failure} role="alert">{t(draft?.failure ?? failure ?? 'failed')}</p>}
    <div className={css.editorRow}>
      {renderFactorySlot('sidebar.files.navigator', { useTabInfo, page: false, treeOnly: true, onOpen })}
      <div ref={container} className={css.editor} />
    </div>
  </section>
}
