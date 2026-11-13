// @vitest-environment jsdom
/** The proxy editor has its own Settings section, separate from Models. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ModelsSectionInjected } from '../src/client/ModelsSection.tsx'
import { ProxySettingsSection, type ProxySettingsSectionProps } from '../src/client/ProxySettingsSection.tsx'
import type { ModelsOperations } from '../src/client/operations.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

it('renders proxy controls in a standalone section without the Models page', () => {
  const namespace: SettingsNamespaceView = {
    ns: 'ui-settings-models', schema: {}, value: { proxySetupComplete: true, proxyVerifyTls: true },
    autoGenerate: false, applies: 'live', revision: 1,
    secrets: [{ path: ['proxyUrl'], set: false }],
  }
  const state = {
    status: 'ready', error: null, credentialError: null, writable: true,
    rows: [], namespaces: new Map([[namespace.ns, namespace]]), credentials: new Map(),
  }
  const controller = { load: vi.fn(async () => {}) }
  const operations = {
    writeSettings: vi.fn<ModelsOperations['writeSettings']>(),
    checkProxy: vi.fn<ModelsOperations['checkProxy']>(),
    storeCredential: vi.fn<ModelsOperations['storeCredential']>(),
    removeCredential: vi.fn<ModelsOperations['removeCredential']>(),
    discoverModels: vi.fn<ModelsOperations['discoverModels']>(),
  }
  const useSnapshot = <T,>(select: (value: typeof state) => T): T => select(state)
  const t = (key: keyof typeof en): string => en[key]
  render(<ProxySettingsSection controller={controller as unknown as ModelsSectionInjected['controller']}
    useSnapshot={useSnapshot as NonNullable<ProxySettingsSectionProps['useSnapshot']>}
    operations={operations as unknown as ModelsOperations} schema={{} as ModelsSectionInjected['schema']} t={t} />)

  expect(screen.getByRole('heading', { name: en.proxyNav })).toBeTruthy()
  expect(screen.getByText(en.proxyIntro)).toBeTruthy()
  expect(screen.getByRole('button', { name: en.proxyEdit })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: en.title })).toBeNull()
})
