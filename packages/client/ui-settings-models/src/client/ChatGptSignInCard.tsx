/** ChatGPT OAuth entry, provider notices, and cancellable interactive questions. */
import { useState } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { AuthorizationPromptId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ChatGptAuthorization } from './chatgpt-authorization.ts'
import type { ChatGptKey } from './chatgpt-locales.ts'
import styles from './ModelsSection.module.css'

/** Plugin-bound operations and redacted state for the ChatGPT card. */
export interface ChatGptSignInInjected {
  hooks: { authorization: ChatGptAuthorization['store'] }
  load: () => Promise<void>
  start: () => Promise<void>
  cancel: () => Promise<void>
  enable: () => Promise<void>
  answer: (id: AuthorizationPromptId, value: string) => Promise<void>
  t: (key: ChatGptKey) => string
}

/** @param props - framework-bound state, actions, and localized labels. @returns the ChatGPT sign-in card. */
export function ChatGptSignInCard({ useAuthorization, load, start, cancel, enable, answer, t }: InjectFace<ChatGptSignInInjected>) {
  const state = useAuthorization(snapshot => snapshot)
  const [draft, setDraft] = useState({ id: '', value: '' })
  const [answering, setAnswering] = useState(false)
  if (state.availability === 'idle') void load()
  if (state.availability === 'unavailable') return null
  const working = state.phase !== 'idle'
  const question = state.prompt
  const value = draft.id === question?.id ? draft.value : ''
  const submit = async (id: AuthorizationPromptId, value: string) => {
    if (answering) return
    setAnswering(true)
    try { await answer(id, value) }
    finally { setAnswering(false); setDraft({ id: '', value: '' }) }
  }
  const noticeUrl = state.notice?.url
  // External authorization notices may navigate only to HTTP(S), never script URLs.
  const link = noticeUrl !== undefined && /^https?:\/\//i.test(noticeUrl) ? noticeUrl : undefined
  const failure = state.failure === undefined ? undefined : {
    load: 'loadFailed', login: 'loginFailed', answer: 'answerFailed', enable: 'enableFailed',
  }[state.failure] as 'loadFailed' | 'loginFailed' | 'answerFailed' | 'enableFailed'
  return <section className={styles['rowCard']} aria-label={t('title')}>
    <div className={styles['rowHead']}>
      <span className={styles['rowName']}>{t('title')}</span>
      {!working && <div className={styles['rowActions']}>
        {state.availability === 'failed'
          ? <button type="button" className={styles['secondaryButton']} onClick={() => { void load() }}>{t('retry')}</button>
          : <button type="button" className={styles['secondaryButton']}
            disabled={state.availability !== 'available' || !state.writable}
            onClick={() => { void start() }}>{t(state.configured ? 'signInAgain' : 'signIn')}</button>}
      </div>}
    </div>
    <p className={styles['intro']}>{t('description')}</p>
    {state.availability === 'loading' && <p role="status" className={styles['advancedHint']}>{t('loading')}</p>}
    {state.configured && <p role="status" className={styles['savedNotice']}>{t('signedIn')}</p>}
    {state.configured && state.enabled && !working && <p className={styles['advancedHint']}>{t('ready')}</p>}
    {state.configured && !state.enabled && !working && <div>
      <button type="button" className={styles['secondaryButton']} onClick={() => { void enable() }}>{t('enable')}</button>
    </div>}
    {state.phase === 'enabling' && <p role="status" className={styles['advancedHint']}>{t('enabling')}</p>}
    {state.phase === 'signing-in' && <div className={styles['oauthBody']}>
      <p role="status" className={styles['advancedHint']}>{t('waiting')}</p>
      <p className={styles['advancedHint']}>{t('browserHint')}</p>
      {state.notice && <div className={styles['oauthBody']}>
        <p className={styles['advancedHint']}>{state.notice.message}</p>
        {link && <a className={styles['oauthLink']} href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t('open')}</a>}
        {state.notice.code && <p className={styles['advancedHint']}>{t('code')}: <strong className={styles['oauthCode']}>{state.notice.code}</strong></p>}
      </div>}
      {question && <form className={styles['oauthBody']} onSubmit={event => { event.preventDefault(); void submit(question.id, value) }}>
        {question.question.kind === 'select'
          ? <p className={styles['fieldLabel']}>{question.question.message}</p>
          : <label className={styles['fieldLabel']} htmlFor={`chatgpt-answer-${question.id}`}>{question.question.message}</label>}
        {question.question.kind === 'select'
          ? <div className={styles['oauthActions']} role="group" aria-label={question.question.message}>
            {question.question.options.map(option => <button key={option.id} type="button" className={styles['secondaryButton']}
              disabled={answering} title={option.description} onClick={() => { void submit(question.id, option.id) }}>{option.label}</button>)}
          </div>
          : <>
            <input id={`chatgpt-answer-${question.id}`} className={styles['input']}
              type={question.question.kind === 'secret' ? 'password' : 'text'} autoComplete="off" spellCheck={false}
              placeholder={question.question.placeholder} value={value} disabled={answering}
              onChange={event => { setDraft({ id: question.id, value: event.target.value }) }} />
            <div><button type="submit" className={styles['secondaryButton']} disabled={answering || value.trim().length === 0}>{t('answer')}</button></div>
          </>}
      </form>}
      <div><button type="button" className={styles['secondaryButton']} onClick={() => { setDraft({ id: '', value: '' }); void cancel() }}>{t('cancel')}</button></div>
    </div>}
    {failure && <p role="alert" className={styles['error']}>
      {t(failure)}
      {failure === 'loginFailed' && state.diagnostic !== undefined && <>
        <br />{t('loginDiagnostic')}: <code>{state.diagnostic}</code>
      </>}
    </p>}
  </section>
}
