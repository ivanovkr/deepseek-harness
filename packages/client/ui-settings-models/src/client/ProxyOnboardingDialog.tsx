/** First-run network setup shared by every model provider in this Host. */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DeepSeekOnboardingInjected } from './DeepSeekOnboardingDialog.tsx'
import { ProxyEditor } from './ProxyEditor.tsx'
import { OnboardingModal } from './OnboardingModal.tsx'

/**
 * Offer a write-only proxy field before credential onboarding, retaining ambient routing when skipped.
 * @param props - settings coordinator and the shared Models settings projection.
 * @returns a network setup dialog, or null after acknowledgement.
 */
export function ProxyOnboardingDialog(props: PropsRuntime<'settings.onboarding'> & InjectFace<DeepSeekOnboardingInjected>): ReactNode {
  const { useModels, controller, operations, schema, complete, t } = props
  const state = useModels(snapshot => snapshot)
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
  return <OnboardingModal title={t('proxyTitle')}>
    <ProxyEditor namespace={namespace} operations={operations} t={t} mode="setup"
      reload={() => controller.load()} onSaved={complete} onCancel={complete} />
  </OnboardingModal>
}
