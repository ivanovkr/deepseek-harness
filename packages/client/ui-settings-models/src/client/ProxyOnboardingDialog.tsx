/** First-run network setup shared by every model provider in this Host. */
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DeepSeekOnboardingInjected } from './DeepSeekOnboardingDialog.tsx'
import { validProxyUrl } from '../onboarding-config.ts'
import { OnboardingModal } from './OnboardingModal.tsx'
import { ApiKeyInput } from './ApiKeyInput.tsx'
import { EditorFooter } from './EditorFooter.tsx'
import styles from './ModelsSection.module.css'

/**
 * Offer a write-only proxy field before credential onboarding, retaining ambient routing when skipped.
 * @param props - settings coordinator and the shared Models settings projection.
 * @returns a network setup dialog, or null after acknowledgement.
 */
export function ProxyOnboardingDialog(props: PropsRuntime<'settings.onboarding'> & InjectFace<DeepSeekOnboardingInjected>): ReactNode {
  const { useModels, controller, operations, schema, complete, t } = props
  const state = useModels(snapshot => snapshot)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const saving = useRef(false)
  const id = useId()
  const namespace = state.namespaces.get('ui-settings-models')
  const acknowledged = namespace !== undefined && schema.getPath(namespace.value, ['proxySetupComplete']) === true
  useEffect(() => {
    if (state.status === 'idle') void controller.load()
  }, [state.status, controller])
  useEffect(() => {
    if (state.status === 'idle' || state.status === 'loading') return
    if (acknowledged || namespace === undefined || !state.writable) complete()
  }, [state.status, acknowledged, namespace, state.writable, complete])

  if (state.status === 'idle' || state.status === 'loading' || acknowledged || namespace === undefined || !state.writable) return null
  const proxy = value.trim()
  const invalid = proxy !== '' && !validProxyUrl(proxy)
  const save = async (skip: boolean): Promise<void> => {
    if (saving.current || (!skip && invalid)) return
    saving.current = true
    setBusy(true)
    setFailed(false)
    try {
      const result = await operations.writeSettings(namespace.ns, [
        ...!skip && proxy !== '' ? [{ op: 'set' as const, path: ['proxyUrl'], value: proxy }] : [],
        { op: 'set', path: ['proxySetupComplete'], value: true },
      ], namespace.revision)
      if (result.kind === 'written') complete()
      else {
        setFailed(true)
        if (result.kind === 'conflict') await controller.load()
      }
    } catch (_error) {
      // Keep the draft and show localized failure; transport errors may carry credential-bearing URLs.
      setFailed(true)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return <OnboardingModal title={t('proxyTitle')}>
    <div className={styles['field']}>
      <label className={styles['fieldLabel']} htmlFor={id}>{t('proxyLabel')}</label>
      <ApiKeyInput id={id} value={value} onChange={(event) => { setValue(event.target.value) }}
        t={t} disabled={busy} placeholder="http://127.0.0.1:8080" aria-describedby={`${id}-hint`}
        aria-invalid={invalid} spellCheck={false} />
      <p id={`${id}-hint`}>{t('proxyHint')}</p>
      {invalid && <p role="alert" className={styles['error']}>{t('proxyInvalid')}</p>}
      {failed && <p role="alert" className={styles['error']}>{t('proxySaveFailed')}</p>}
    </div>
    <EditorFooter t={t} busy={busy} submitDisabled={busy || invalid}
      submitLabelKey="proxyContinue" submitBusyLabelKey="applying" cancelLabelKey="onboardingLater"
      onCancel={() => { void save(true) }} onSubmit={() => { void save(false) }} />
  </OnboardingModal>
}
