// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ResourceSnapshot, UseResource } from '@deepseek-ai/dsh-client-resources/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { DevelopmentView } from '../src/client/DevelopmentView.tsx'
import { en, ru, type DevelopmentKey } from '../src/client/locales.ts'
import type { Board, Document } from '../src/client/model.ts'
import type {} from '../src/client/index.ts'

afterEach(cleanup)
const board: Board = { missing: false, changes: [
  { id: 'empty-change', files: [] },
  { id: 'task-change', files: [{ kind: 'tasks', path: 'openspec/changes/task-change/tasks.md' }] },
  { id: 'all-types', files: [
    { kind: 'proposal', path: 'openspec/changes/all-types/proposal.md' }, { kind: 'specs', path: 'openspec/changes/all-types/specs/api/spec.md' },
    { kind: 'design', path: 'openspec/changes/all-types/design.md' }, { kind: 'tasks', path: 'openspec/changes/all-types/tasks.md' },
  ] },
] }
function props(snapshot: ResourceSnapshot<Board>, document: ResourceSnapshot<Document> = { status: 'live', value: { path: '', text: '# Actual task document\n- [x] Implement feature\n- [ ] Review changes' }, failure: undefined }) {
  const useResource = ((address: string) => address.includes('development-document') ? document : snapshot) as UseResource
  return { sessionId: 'session' as SessionId, boardAddress: 'dsh-resource://development-board/session', refresh: vi.fn(), useResource,
    t: (key: DevelopmentKey) => en[key],
  } as Parameters<typeof DevelopmentView>[0]
}

describe('development document view', () => {
  it('groups document presence and shows actual task text separately from task evidence', () => {
    const p = props({ status: 'live', value: board, failure: undefined })
    render(<DevelopmentView {...p} />)
    expect(within(screen.getByRole('region', { name: en.noDocuments })).getByRole('button', { name: 'empty-change' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: en.someDocuments })).getByRole('button', { name: 'task-change' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: en.allDocuments })).getByRole('button', { name: 'all-types' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'task-change' }))
    const tasks = screen.getByRole('region', { name: en.taskHeading })
    expect(within(tasks).getByText('1/2')).toBeTruthy()
    const checked = within(tasks).getByRole('checkbox', { name: 'Checked: Implement feature' }) as HTMLInputElement
    expect(checked.checked).toBe(true)
    expect(checked.disabled).toBe(true)
    expect(screen.getByText(en.taskDisclaimer)).toBeTruthy()
    expect({ heading: within(tasks).getByRole('heading').textContent, disclaimer: within(tasks).getByText(en.taskDisclaimer).textContent }).toMatchInlineSnapshot(`
      {
        "disclaimer": "Checkboxes record task text only, not tests or approval.",
        "heading": "Task checkboxes 1/2",
      }
    `)
    expect(screen.getByRole('heading', { name: 'Actual task document' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.refresh }))
    expect(p.refresh).toHaveBeenCalledOnce()
  })
  it('renders missing, empty, loading and failure states without stale documents', () => {
    const view = render(<DevelopmentView {...props({ status: 'loading', value: undefined, failure: undefined })} />)
    expect(screen.getByText(en.loading)).toBeTruthy()
    view.rerender(<DevelopmentView {...props({ status: 'live', value: { missing: true, changes: [] }, failure: undefined })} />)
    expect(screen.getByText(en.missing)).toBeTruthy()
    view.rerender(<DevelopmentView {...props({ status: 'live', value: { missing: false, changes: [] }, failure: undefined })} />)
    expect(screen.getByText(en.empty)).toBeTruthy()
    view.rerender(<DevelopmentView {...props({ status: 'failed', value: board, failure: new RemoteError('development/read-failed', 'Access denied', {}) })} />)
    expect(screen.getByRole('alert').textContent).toContain('Access denied')
    expect(screen.queryByRole('button', { name: 'all-types' })).toBeNull()
  })
  it('keeps absent category detail explicit and renders Russian labels', () => {
    const p = props({ status: 'live', value: board, failure: undefined })
    const t = ((key: DevelopmentKey) => ru[key]) as typeof p.t
    render(<DevelopmentView {...p} t={t} />)
    expect(screen.getByRole('heading', { name: ru.heading })).toBeTruthy()
    expect(screen.getByText(ru.absent)).toBeTruthy()
    expect(screen.getByRole('button', { name: ru.refresh })).toBeTruthy()
  })
})
