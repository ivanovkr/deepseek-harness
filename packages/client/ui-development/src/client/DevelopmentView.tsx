/** Read-only kanban of standard documents with selected-change detail. */
import { useState } from 'react'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceSnapshot, UseResource } from '@deepseek-ai/dsh-client-resources/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { artifactKinds, documentCount, parseTasks, type ArtifactKind, type Change } from './model.ts'
import { documentAddress } from './resources.ts'
import css from './DevelopmentView.module.css'

/** Apply-bound read-only commands and resource identity. */
export interface DevelopmentInjected { readonly boardAddress: string; readonly refresh: () => void; readonly sessionId: SessionId }
type Props = PropsRuntime<'conversation.view'> & PropsLocale<'development'> & DevelopmentInjected
type Copy = PropsLocale<'development'>

function ResourceState({ resource, t }: { resource: ResourceSnapshot<unknown> } & Copy) {
  if (resource.status === 'failed') return <div role="alert" className={css.message}>{t('failed')}<p>{resource.failure?.message} ({resource.failure?.code})</p></div>
  return <p role="status" className={css.message}>{t(resource.status === 'none' ? 'unavailable' : 'loading')}</p>
}

function DocumentView({ path, kind, sessionId, useResource, t }: { path: string; kind: ArtifactKind; sessionId: SessionId; useResource: UseResource } & Copy) {
  const resource = useResource<'development-document'>(documentAddress(sessionId, path))
  if (resource.status !== 'live' || resource.value === undefined) return <ResourceState resource={resource} t={t} />
  const tasks = kind === 'tasks' ? parseTasks(resource.value.text) : []
  const labels = { code: { copyLabel: t('copy'), copiedLabel: t('copied'), toolbarLabels: { codeLabel: t('code'), wrapLabel: t('wrap'), unwrapLabel: t('unwrap') } }, footnotes: t('footnotes') }
  return <div className={css.document}>
    {kind === 'tasks' && <section aria-label={t('taskHeading')} className={css.tasks}>
      <h4>{t('taskHeading')} <span>{tasks.filter(task => task.checked).length}/{tasks.length}</span></h4>
      <p className={css.muted}>{t('taskDisclaimer')}</p>
      {tasks.length === 0 ? <p>{t('noTasks')}</p> : <ul>{tasks.map(task => <li key={task.line}>
        <input type="checkbox" checked={task.checked} disabled aria-label={`${t(task.checked ? 'checked' : 'unchecked')}: ${task.text}`} />
        <span>{task.text}</span>
      </li>)}</ul>}
    </section>}
    <section aria-label={t('source')}><MarkdownText text={resource.value.text} labels={labels} /></section>
  </div>
}

function ChangeDetail({ change, sessionId, useResource, t }: { change: Change; sessionId: SessionId; useResource: UseResource } & Copy) {
  const [kind, setKind] = useState<ArtifactKind>(change.files.some(file => file.kind === 'proposal') ? 'proposal' : change.files[0]?.kind ?? 'proposal')
  const [selectedPath, setSelectedPath] = useState<string>()
  const files = change.files.filter(file => file.kind === kind)
  const selected = files.find(file => file.path === selectedPath) ?? files[0]
  return <section className={css.detail} aria-label={change.id}>
    <h3>{change.id}</h3>
    <div className={css.artifacts} role="group" aria-label={change.id}>
      {artifactKinds.map(item => <Button key={item} aria-pressed={kind === item} className={css.control} variant={kind === item ? 'outline' : 'ghost'} onClick={() => { setKind(item); setSelectedPath(undefined) }}>
        {t(item)} <span className={css.muted}>{change.files.filter(file => file.kind === item).length}</span>
      </Button>)}
    </div>
    {files.length === 0 ? <p className={css.message}>{t('absent')}</p> : <>
      <div className={css.files}>{files.map(file => <Button key={file.path} className={css.file} aria-pressed={selected?.path === file.path} onClick={() => setSelectedPath(file.path)}>{file.path}</Button>)}</div>
      {selected && <DocumentView key={selected.path} path={selected.path} kind={kind} sessionId={sessionId} useResource={useResource} t={t} />}
    </>}
  </section>
}

/** Render resources through framework hooks; selection is local to this view.
 * @param props - Session identity, framework resources, copy, and refresh command.
 * @returns Inventory, honest failures, and complete document detail.
 */
export function DevelopmentView({ boardAddress, refresh, sessionId, useResource, t }: Props) {
  const resource = useResource<'development-board'>(boardAddress)
  const [selectedId, setSelectedId] = useState<string>()
  const board = resource.status === 'live' ? resource.value : undefined
  const selected = board?.changes.find(change => change.id === selectedId) ?? board?.changes[0]
  return <section className={css.view} aria-label={t('heading')}>
    <header className={css.header}><h2>{t('heading')}</h2><Button variant="outline" className={css.control} onClick={refresh}>{t('refresh')}</Button></header>
    <p className={css.muted}>{t('disclaimer')}</p>
    {!board ? <ResourceState resource={resource} t={t} /> : board.changes.length === 0 ? <p role="status" className={css.message}>{t(board.missing ? 'missing' : 'empty')}</p> : <>
      <div className={css.board}>
        {(['noDocuments', 'someDocuments', 'allDocuments'] as const).map((column, index) => {
          const changes = board.changes.filter(change => { const count = documentCount(change); return index === 0 ? count === 0 : index === 1 ? count > 0 && count < 4 : count === 4 })
          return <section key={column} className={css.column} aria-label={t(column)}><h3>{t(column)} <span className={css.muted}>{changes.length}</span></h3>
            <div className={css.cards}>{changes.map(change => <Button key={change.id} aria-label={change.id} aria-pressed={selected?.id === change.id} className={css.card} variant="outline" onClick={() => setSelectedId(change.id)}>
              <strong>{change.id}</strong><span className={css.muted}>{documentCount(change)}/4</span>
            </Button>)}</div>
          </section>
        })}
      </div>
      {selected ? <ChangeDetail key={`${sessionId}/${selected.id}`} change={selected} sessionId={sessionId} useResource={useResource} t={t} /> : <p>{t('select')}</p>}
    </>}
  </section>
}
