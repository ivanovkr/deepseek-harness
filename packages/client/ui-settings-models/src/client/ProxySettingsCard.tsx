/** Persistent access to shared proxy settings, including existing installations. */
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ModelsOperations } from './operations.ts'
import type { en } from './locales.ts'
import { hasSavedProxy, ProxyEditor } from './ProxyEditor.tsx'
import styles from './ModelsSection.module.css'

/**
 * Keep the proxy editor available independently of first-run progress and current sessions.
 * @param props - current settings projection, write access, and refresh operation.
 * @returns a Models-page proxy card with a write-only editor.
 */
export function ProxySettingsCard({ namespace, writable, operations, t, reload }: {
  namespace: SettingsNamespaceView
  writable: boolean
  operations: ModelsOperations
  t: (key: keyof typeof en) => string
  reload: () => Promise<void>
}): ReactNode {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  return <div className={styles['rowCard']}>
    <div className={styles['rowHead']}>
      <span className={styles['rowName']}>{t('proxySettings')}</span>
      {!editing && <div className={styles['rowActions']}><button type="button" className={styles['secondaryButton']} disabled={!writable}
        onClick={() => { setSaved(false); setEditing(true) }}>{t('proxyEdit')}</button></div>}
    </div>
    <p className={styles['intro']}>{t(hasSavedProxy(namespace) ? 'proxyConfigured' : 'proxyEnvironment')}</p>
    {saved && <p role="status" className={styles['savedNotice']}>{t('proxySaved')}</p>}
    {editing && writable && <ProxyEditor namespace={namespace} operations={operations} t={t} mode="settings"
      reload={reload} onCancel={() => { setEditing(false) }} onSaved={() => {
        setEditing(false)
        setSaved(true)
        void reload()
      }} />}
  </div>
}
