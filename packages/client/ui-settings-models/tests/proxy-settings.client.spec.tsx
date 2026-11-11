// @vitest-environment jsdom
/** Persistent proxy access for users who already have providers and sessions. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import { ProxySettingsCard } from '../src/client/ProxySettingsCard.tsx'
import type { ModelsOperations } from '../src/client/operations.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

function setup(stored = false, writable = true) {
  const namespace: SettingsNamespaceView = {
    ns: 'ui-settings-models', schema: {}, value: { proxySetupComplete: true },
    autoGenerate: false, applies: 'live', revision: 12,
    secrets: [{ path: ['proxyUrl'], set: stored }],
  }
  const writeSettings = vi.fn<ModelsOperations['writeSettings']>(async () => ({ kind: 'written', view: namespace }))
  const operations: ModelsOperations = {
    writeSettings,
    storeCredential: async () => undefined,
    removeCredential: async () => undefined,
    discoverModels: async () => ({ kind: 'found', models: [] }),
  }
  const reload = vi.fn(async () => {})
  render(<ProxySettingsCard namespace={namespace} writable={writable} operations={operations} t={key => en[key]} reload={reload} />)
  return { writeSettings, reload }
}

it('allows configuring a proxy after initial setup is complete', async () => {
  const h = setup()
  fireEvent.click(screen.getByRole('button', { name: en.proxyEdit }))
  const input = screen.getByLabelText(en.proxyLabel)
  fireEvent.change(input, { target: { value: 'http://127.0.0.1:7890' } })
  expect(input.getAttribute('type')).toBe('password')
  fireEvent.click(screen.getByRole('button', { name: en.apply }))
  await waitFor(() => { expect(screen.getByRole('status').textContent).toBe(en.proxySaved) })
  expect(h.writeSettings).toHaveBeenCalledWith('ui-settings-models', [
    { op: 'set', path: ['proxyUrl'], value: 'http://127.0.0.1:7890' },
    { op: 'set', path: ['proxySetupComplete'], value: true },
  ], 12)
  expect(h.reload).toHaveBeenCalledOnce()
})

it('removes a saved proxy through an explicit restore-environment action', async () => {
  const h = setup(true)
  expect(screen.getByText(en.proxyConfigured)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: en.proxyEdit }))
  expect((screen.getByLabelText(en.proxyLabel) as HTMLInputElement).value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: en.proxyReset }))
  await waitFor(() => { expect(h.reload).toHaveBeenCalledOnce() })
  expect(h.writeSettings).toHaveBeenCalledWith('ui-settings-models', [
    { op: 'unset', path: ['proxyUrl'] },
    { op: 'set', path: ['proxySetupComplete'], value: true },
  ], 12)
})

it('retains a saved proxy when its replacement field is blank', async () => {
  const h = setup(true)
  fireEvent.click(screen.getByRole('button', { name: en.proxyEdit }))
  fireEvent.click(screen.getByRole('button', { name: en.apply }))
  await waitFor(() => { expect(h.reload).toHaveBeenCalledOnce() })
  expect(h.writeSettings).toHaveBeenCalledWith('ui-settings-models', [
    { op: 'set', path: ['proxySetupComplete'], value: true },
  ], 12)
})

it('cancels without persisting or acknowledging any new change', () => {
  const h = setup(true)
  fireEvent.click(screen.getByRole('button', { name: en.proxyEdit }))
  fireEvent.change(screen.getByLabelText(en.proxyLabel), { target: { value: 'http://other.example:8888' } })
  fireEvent.click(screen.getByRole('button', { name: en.cancel }))
  expect(screen.queryByLabelText(en.proxyLabel)).toBeNull()
  expect(h.writeSettings).not.toHaveBeenCalled()
})

it('keeps failed drafts open and never echoes a Host error carrying a proxy password', async () => {
  const h = setup()
  h.writeSettings.mockResolvedValueOnce({ kind: 'refused', message: 'http://user:private-password@proxy.example' })
  fireEvent.click(screen.getByRole('button', { name: en.proxyEdit }))
  fireEvent.change(screen.getByLabelText(en.proxyLabel), { target: { value: 'http://proxy.example:7890' } })
  fireEvent.click(screen.getByRole('button', { name: en.apply }))
  await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe(en.proxySaveFailed) })
  expect(document.body.textContent).not.toContain('private-password')
  expect((screen.getByLabelText(en.proxyLabel) as HTMLInputElement).value).toBe('http://proxy.example:7890')
  expect(h.reload).not.toHaveBeenCalled()
})

it('shows existing routing without permitting edits in read-only deployments', () => {
  const h = setup(true, false)
  expect(screen.getByRole('button', { name: en.proxyEdit }).hasAttribute('disabled')).toBe(true)
  expect(h.writeSettings).not.toHaveBeenCalled()
})
