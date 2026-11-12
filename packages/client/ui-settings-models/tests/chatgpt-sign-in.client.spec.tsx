// @vitest-environment jsdom
/** ChatGPT sign-in renders provider instructions without exposing submitted answers. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { AuthorizationPromptId } from '@deepseek-ai/dsh-api-remotes/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { ChatGptSignInCard } from '../src/client/ChatGptSignInCard.tsx'
import type { ChatGptAuthorizationState } from '../src/client/chatgpt-authorization.ts'
import { chatGptEn } from '../src/client/chatgpt-locales.ts'

const PROMPT = 'question-one' as AuthorizationPromptId
const NEXT_PROMPT = 'question-two' as AuthorizationPromptId
afterEach(cleanup)

function fixture(initial: Partial<ChatGptAuthorizationState> = {}) {
  const store = createSnapshotStore<ChatGptAuthorizationState>({
    availability: 'available', configured: false, writable: true, phase: 'idle', enabled: false,
    notice: undefined, prompt: undefined, failure: undefined, diagnostic: undefined, ...initial,
  })
  const load = vi.fn(async () => {})
  const start = vi.fn(async () => {})
  const cancel = vi.fn(async () => {})
  const enable = vi.fn(async () => {})
  const answer = vi.fn(async (_id: AuthorizationPromptId, _value: string) => {})
  render(<ChatGptSignInCard useAuthorization={bindSnapshotSelector(store)} load={load} start={start}
    cancel={cancel} enable={enable} answer={answer} t={key => chatGptEn[key]} />)
  return { load, start, cancel, enable, answer, update: (next: Partial<ChatGptAuthorizationState>) => act(() => store.update(s => { Object.assign(s, next) })) }
}

it('offers ChatGPT sign-in without requesting an API key', () => {
  const f = fixture()
  expect(screen.getByText(chatGptEn.description)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: chatGptEn.signIn }))
  expect(f.start).toHaveBeenCalledOnce()
  expect(screen.queryByRole('textbox')).toBeNull()
})

it.each(['loading', 'idle'] as const)('disables sign-in while credential availability is %s', (availability) => {
  const f = fixture({ availability })
  expect(screen.getByRole('button', { name: chatGptEn.signIn }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: chatGptEn.signIn }))
  expect(f.start).not.toHaveBeenCalled()
  if (availability === 'idle') expect(f.load).toHaveBeenCalledOnce()
  else expect(screen.getByRole('status').textContent).toBe(chatGptEn.loading)
})

it('hides unavailable flows and prevents sign-in to a read-only or busy credential', () => {
  const f = fixture({ availability: 'unavailable' })
  expect(screen.queryByRole('region')).toBeNull()
  f.update({ availability: 'available', writable: false })
  expect(screen.getByRole('button', { name: chatGptEn.signIn }).hasAttribute('disabled')).toBe(true)
})

it('retries a failed credential check and displays fixed recovery copy', () => {
  const f = fixture({ availability: 'failed', failure: 'load' })
  expect(screen.getByRole('alert').textContent).toBe(chatGptEn.loadFailed)
  fireEvent.click(screen.getByRole('button', { name: chatGptEn.retry }))
  expect(f.load).toHaveBeenCalledOnce()
  expect(f.start).not.toHaveBeenCalled()
})

it('keeps the committed sign-in visible and retries only model activation after partial failure', () => {
  const f = fixture({ configured: true, failure: 'enable' })
  expect(screen.getByRole('status').textContent).toBe(chatGptEn.signedIn)
  expect(screen.getByRole('alert').textContent).toBe(chatGptEn.enableFailed)
  fireEvent.click(screen.getByRole('button', { name: chatGptEn.enable }))
  expect(f.enable).toHaveBeenCalledOnce()
  expect(f.start).not.toHaveBeenCalled()
  f.update({ phase: 'enabling' })
  expect(screen.getByText(chatGptEn.enabling)).toBeTruthy()
  expect(screen.queryByRole('button', { name: chatGptEn.signInAgain })).toBeNull()
  f.update({ phase: 'idle', enabled: true, failure: undefined })
  expect(screen.getByText(chatGptEn.ready)).toBeTruthy()
  expect(screen.queryByRole('button', { name: chatGptEn.enable })).toBeNull()
})

it('renders a device verification URL and code with safe navigation attributes', () => {
  const f = fixture({ phase: 'signing-in', notice: { message: 'Enter this code', url: 'https://auth.openai.com/codex/device', code: 'ABCD-EFGH' } })
  expect(screen.getByText('ABCD-EFGH')).toBeTruthy()
  const link = screen.getByRole('link', { name: chatGptEn.open })
  expect(link.getAttribute('href')).toBe('https://auth.openai.com/codex/device')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  expect(link.getAttribute('referrerpolicy')).toBe('no-referrer')
  expect(screen.getByText(chatGptEn.browserHint)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: chatGptEn.cancel }))
  expect(f.cancel).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: chatGptEn.signIn })).toBeNull()
})

it.each(['javascript:alert(1)', 'data:text/html,unsafe', 'file:///private'])('does not link unsafe authorization navigation %s', (url) => {
  fixture({ phase: 'signing-in', notice: { message: 'Provider instruction', url } })
  expect(screen.getByText('Provider instruction')).toBeTruthy()
  expect(screen.queryByRole('link')).toBeNull()
})

it('submits login-method option IDs and disables duplicate answers until completion', async () => {
  const f = fixture({ phase: 'signing-in', prompt: { id: PROMPT, question: {
    kind: 'select', message: 'Choose login method', options: [
      { id: 'browser', label: 'Browser login', description: 'Uses local callback' },
      { id: 'device_code', label: 'Device code login' },
    ],
  } } })
  const response = Promise.withResolvers<void>()
  f.answer.mockImplementationOnce(() => response.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Device code login' }))
  expect(f.answer).toHaveBeenCalledWith(PROMPT, 'device_code')
  expect(screen.getByRole('button', { name: 'Browser login' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Browser login' }).getAttribute('title')).toBe('Uses local callback')
  fireEvent.click(screen.getByRole('button', { name: 'Browser login' }))
  expect(f.answer).toHaveBeenCalledOnce()
  await act(async () => response.resolve())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Browser login' }).hasAttribute('disabled')).toBe(false))
})

it.each(['text', 'secret'] as const)('submits a %s answer and clears its local draft', async (kind) => {
  const f = fixture({ phase: 'signing-in', prompt: { id: PROMPT, question: { kind, message: 'Paste authorization', placeholder: 'Redirect URL' } } })
  const input = screen.getByLabelText<HTMLInputElement>('Paste authorization')
  expect(input.type).toBe(kind === 'secret' ? 'password' : 'text')
  expect(input.autocomplete).toBe('off')
  expect(screen.getByRole('button', { name: chatGptEn.answer }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(input, { target: { value: 'private-auth-code' } })
  fireEvent.click(screen.getByRole('button', { name: chatGptEn.answer }))
  await waitFor(() => expect(input.value).toBe(''))
  expect(f.answer).toHaveBeenCalledWith(PROMPT, 'private-auth-code')
  expect(document.body.textContent).not.toContain('private-auth-code')
})

it('withdraws a manual callback question and never carries its draft into a different question', () => {
  const f = fixture({ phase: 'signing-in', prompt: { id: PROMPT, question: { kind: 'text', message: 'Old question' } } })
  fireEvent.change(screen.getByLabelText('Old question'), { target: { value: 'old-auth-code' } })
  f.update({ prompt: undefined })
  expect(screen.queryByRole('textbox')).toBeNull()
  f.update({ prompt: { id: NEXT_PROMPT, question: { kind: 'text', message: 'New question' } } })
  expect(screen.getByLabelText<HTMLInputElement>('New question').value).toBe('')
  expect(f.answer).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('New question'), { target: { value: 'new-auth-code' } })
  fireEvent.click(screen.getByRole('button', { name: chatGptEn.cancel }))
  expect(screen.getByLabelText<HTMLInputElement>('New question').value).toBe('')
})

it.each([['login', chatGptEn.loginFailed], ['answer', chatGptEn.answerFailed]] as const)('shows localized %s recovery guidance', (failure, text) => {
  fixture({ phase: 'signing-in', failure })
  expect(screen.getByRole('alert').textContent).toBe(text)
})

it('shows only the safe technical category beside the sign-in error', () => {
  fixture({ phase: 'signing-in', failure: 'login', diagnostic: 'DNS_LOOKUP' })
  const alert = screen.getByRole('alert')
  expect(alert.textContent).toContain(chatGptEn.loginFailed)
  expect(alert.textContent).toContain(`${chatGptEn.loginDiagnostic}: DNS_LOOKUP`)
})
