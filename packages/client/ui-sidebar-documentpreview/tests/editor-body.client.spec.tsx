// @vitest-environment jsdom
/** Editor actions retain drafts and expose conditional-save failures to users. */
import { useSyncExternalStore } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { EditorBody, type EditorBodyProps } from '../src/client/editor/EditorBody.tsx'
import { createEditorStore } from '../src/client/editor/store.ts'
import { decodeEditorText } from '../src/client/editor/text.ts'
import type { EditorMountOptions } from '../src/client/editor/runtime.ts'
import { en, ru } from '../src/client/editor/locales.ts'
import { ADDRESS, harness } from './fixtures.client.ts'

afterEach(cleanup)

function setup() {
  const h = harness()
  const instance = createEditorStore().create()
  const value = decodeEditorText(new TextEncoder().encode('original\n'), 'v1')!
  instance.actions.loaded(ADDRESS, value)
  let editor: EditorMountOptions | undefined
  const dispose = vi.fn()
  const mount = vi.fn<EditorBodyProps['mount']>(async (_container, options) => { editor = options; return dispose })
  const save = vi.fn<EditorBodyProps['save']>().mockResolvedValue({ version: 'v2' })
  const loaded = vi.fn()
  const reload = vi.fn()
  const confirmDiscard = vi.fn(() => true)
  const props: EditorBodyProps = {
    ...h.props(), resourceAddress: ADDRESS,
    content: { kind: 'renderer', revision: 1, loaded, failed: vi.fn(), reload },
    wrap: false, scrollportRef: vi.fn(), addResource: vi.fn(), setResources: vi.fn(), confirmDiscard,
    useStore: selector => selector(useSyncExternalStore(listener => instance.subscribe(listener), () => instance.getSnapshot())),
    actions: instance.actions, t: makeTranslate(en),
    useEditorTheme: selector => selector({ active: { colorScheme: 'light' }, fontSizes: { code: 14 } } as never),
    load: vi.fn(async () => value), save, mount, guardDraft: vi.fn(),
  }
  return { props, instance, save, mount, dispose, reload, loaded, confirmDiscard,
    change: (text: string) => { act(() => { editor?.changed(text) }) },
    shortcut: () => { act(() => { editor?.save() }) },
  }
}

it('saves a dirty draft from the toolbar or shortcut and retains edits typed during an in-flight save', async () => {
  const h = setup()
  const view = render(<EditorBody {...h.props} />)
  await waitFor(() => { expect(h.mount).toHaveBeenCalledOnce() })
  expect(screen.getByRole('button', { name: en.save }).hasAttribute('disabled')).toBe(true)
  h.change('edit\n')
  expect(screen.getByRole('status').textContent).toBe(en.dirty)
  let complete: ((value: { version: string }) => void) | undefined
  h.save.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
  fireEvent.click(screen.getByRole('button', { name: en.save }))
  expect(h.save.mock.calls[0]?.[1]).toMatchObject({ text: 'edit\n', version: 'v1' })
  h.change('later\n')
  await act(async () => { complete?.({ version: 'v2' }) })
  expect(h.instance.getSnapshot().drafts[ADDRESS]).toMatchObject({ text: 'later\n', original: 'edit\n', version: 'v2' })
  h.shortcut()
  await waitFor(() => { expect(screen.getByRole('status').textContent).toBe(en.saved) })
  expect(h.save.mock.calls[1]?.[1]).toMatchObject({ text: 'later\n', version: 'v2' })
  view.unmount()
  expect(h.dispose).toHaveBeenCalledOnce()
})

it.each(['conflict', 'unknown', 'denied', 'failed'] as const)('retains the draft and reports %s in Russian', async (failure) => {
  const h = setup()
  h.save.mockResolvedValue({ failure })
  render(<EditorBody {...h.props} t={makeTranslate(ru)} />)
  await waitFor(() => { expect(h.mount).toHaveBeenCalledOnce() })
  h.change('my draft')
  h.shortcut()
  await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe(ru[failure]) })
  expect(h.instance.getSnapshot().drafts[ADDRESS]?.text).toBe('my draft')
  if (failure === 'unknown' || failure === 'conflict') {
    h.shortcut()
    expect(h.save).toHaveBeenCalledOnce()
  }
})

it('restores a dirty draft on reopen and asks before explicitly discarding it', async () => {
  const h = setup()
  const first = render(<EditorBody {...h.props} />)
  await waitFor(() => { expect(h.mount).toHaveBeenCalledOnce() })
  h.change('retained draft')
  first.unmount()
  render(<EditorBody {...h.props} />)
  await waitFor(() => { expect(h.mount).toHaveBeenCalledTimes(2) })
  expect(h.mount.mock.calls[1]?.[1].text).toBe('retained draft')
  expect(screen.getByRole('status').textContent).toMatchInlineSnapshot('"Unsaved changes — drafts remain available when you reopen this file."')
  h.confirmDiscard.mockReturnValueOnce(false)
  fireEvent.click(screen.getByRole('button', { name: en.reload }))
  expect(h.instance.getSnapshot().drafts[ADDRESS]?.text).toBe('retained draft')
  fireEvent.click(screen.getByRole('button', { name: en.reload }))
  await waitFor(() => { expect(h.instance.getSnapshot().drafts[ADDRESS]?.text).toBe('original\n') })
  expect(h.reload).toHaveBeenCalledOnce()
})
