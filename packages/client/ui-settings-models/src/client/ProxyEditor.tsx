/** Write-only shared proxy editor used by first-run setup and Models settings. */
import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SettingsNamespaceView, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ModelsOperations } from './operations.ts'
import type { en } from './locales.ts'
import { validProxyUrl } from '../onboarding-config.ts'
import { ApiKeyInput } from './ApiKeyInput.tsx'
import { EditorFooter } from './EditorFooter.tsx'
import styles from './ModelsSection.module.css'

/**
 * Read the presence of a saved proxy without disclosing its URL.
 * @param namespace - redacted Host settings descriptor.
 * @returns whether its proxy secret is configured.
 */
export function hasSavedProxy(namespace: SettingsNamespaceView): boolean {
  return namespace.secrets?.some(secret => secret.path.length === 1 && secret.path[0] === 'proxyUrl' && secret.set) === true
}

/** Shared proxy form dependencies and containing-surface callbacks. */
export interface ProxyEditorProps {
  namespace: SettingsNamespaceView
  operations: ModelsOperations
  t: (key: keyof typeof en) => string
  mode: 'setup' | 'settings'
  onSaved: () => void
  onCancel: () => void
  reload: () => Promise<void>
}

/**
 * Save, replace, or remove the shared proxy without reading its stored credentials.
 * @param props - current namespace revision and surface-owned actions.
 * @returns the proxy form, with failures retaining its draft.
 */
export function ProxyEditor({ namespace, operations, t, mode, onSaved, onCancel, reload }: ProxyEditorProps): ReactNode {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const saving = useRef(false)
  const id = useId()
  const stored = hasSavedProxy(namespace)
  const proxy = value.trim()
  const invalid = proxy !== '' && !validProxyUrl(proxy)
  const save = async (action: 'apply' | 'skip' | 'reset'): Promise<void> => {
    if (saving.current || (action === 'apply' && invalid)) return
    saving.current = true
    setBusy(true)
    setFailed(false)
    const ops: SettingsPathOpView[] = []
    if (action === 'reset') ops.push({ op: 'unset', path: ['proxyUrl'] })
    else if (action === 'apply' && proxy !== '') ops.push({ op: 'set', path: ['proxyUrl'], value: proxy })
    ops.push({ op: 'set', path: ['proxySetupComplete'], value: true })
    try {
      const result = await operations.writeSettings(namespace.ns, ops, namespace.revision)
      if (result.kind === 'written') onSaved()
      else {
        setFailed(true)
        if (result.kind === 'conflict') await reload()
      }
    } catch (_error) {
      // Transport exceptions may contain proxy credentials; keep them out of visible errors.
      setFailed(true)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return <>
    <div className={styles['field']}>
      <label className={styles['fieldLabel']} htmlFor={id}>{t('proxyLabel')}</label>
      <ApiKeyInput id={id} value={value} onChange={(event) => { setValue(event.target.value) }}
        t={t} disabled={busy} placeholder={stored ? t('proxyKeepSaved') : 'http://127.0.0.1:7890'}
        aria-describedby={`${id}-hint`} aria-invalid={invalid} spellCheck={false} />
      <p id={`${id}-hint`} className={styles['intro']}>{t('proxyHint')}</p>
      {invalid && <p role="alert" className={styles['error']}>{t('proxyInvalid')}</p>}
      {failed && <p role="alert" className={styles['error']}>{t('proxySaveFailed')}</p>}
      {mode === 'settings' && stored && <button type="button" className={styles['secondaryButton']}
        disabled={busy} onClick={() => { void save('reset') }}>{t('proxyReset')}</button>}
    </div>
    <EditorFooter t={t} busy={busy} submitDisabled={busy || invalid}
      submitLabelKey={mode === 'setup' ? 'proxyContinue' : 'apply'} submitBusyLabelKey="applying"
      cancelLabelKey={mode === 'setup' ? 'onboardingLater' : 'cancel'}
      onCancel={() => { if (mode === 'setup') void save('skip'); else onCancel() }}
      onSubmit={() => { void save('apply') }} />
  </>
}
