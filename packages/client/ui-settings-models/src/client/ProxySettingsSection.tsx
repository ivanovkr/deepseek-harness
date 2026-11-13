/** Dedicated network-proxy settings section. */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelsSectionInjected } from './ModelsSection.tsx'

import { ProxySettingsCard } from './ProxySettingsCard.tsx'
import styles from './ModelsSection.module.css'

/** Props delivered by the settings-section slot. */
export type ProxySettingsSectionProps = Partial<InjectFace<ModelsSectionInjected>>

/** Render proxy settings independently from model-provider configuration. */
export function ProxySettingsSection(props: ProxySettingsSectionProps): ReactNode {
  const { controller, useSnapshot, operations, t } = props
  if (controller === undefined || useSnapshot === undefined || operations === undefined || t === undefined) return null
  return <Loaded controller={controller} useSnapshot={useSnapshot} operations={operations} t={t} />
}

function Loaded({ controller, useSnapshot, operations, t }: {
  controller: ModelsSectionInjected['controller']
  useSnapshot: InjectFace<ModelsSectionInjected>['useSnapshot']
  operations: ModelsSectionInjected['operations']
  t: ModelsSectionInjected['t']
}): ReactNode {
  const state = useSnapshot(snapshot => snapshot)
  useEffect(() => {
    if (state.status === 'idle') void controller.load()
  }, [state.status, controller])

  const namespace = state.namespaces.get('ui-settings-models')
  return <div className={styles['section']}>
    <h2 className={styles['title']}>{t('proxyNav')}</h2>
    <p className={styles['intro']}>{t('proxyIntro')}</p>
    {state.status === 'loading' && namespace === undefined
      ? <p role="status" className={styles['intro']}>{t('proxyLoading')}</p>
      : null}
    {state.status === 'error' && namespace === undefined
      ? <p role="alert" className={styles['error']}>{t('proxyLoadFailed')}</p>
      : null}
    {namespace !== undefined
      ? <ProxySettingsCard namespace={namespace} writable={state.writable} operations={operations}
        t={t} reload={() => controller.load()} />
      : null}
    {!state.writable && state.status === 'ready' ? <p className={styles['notice']}>{t('readOnly')}</p> : null}
  </div>
}
