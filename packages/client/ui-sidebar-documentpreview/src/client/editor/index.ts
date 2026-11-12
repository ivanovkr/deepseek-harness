/** Monaco renderer registration and authorized file operations. */
import type { Context } from '@deepseek-ai/cordis'
import { CODE_HIGHLIGHT_EXTENSIONS } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EditorDraft } from './store.ts'
import { createEditorStore } from './store.ts'
import { decodeEditorText, encodeEditorText } from './text.ts'
import { en, ru, zh } from './locales.ts'
import { EditorBody } from './EditorBody.tsx'
import type { EditorMountOptions } from './runtime.ts'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { hostFileOf } from '../rpc.ts'
import type {} from '../index.ts'

const ID = '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/editor'

/** Load and save callbacks and page-exit draft protection supplied through injection. */
export interface EditorInjected {
  readonly load: (address: string, signal: AbortSignal) => Promise<EditorDraft | 'failed' | 'unsupported' | 'conflict'>
  readonly save: (address: string, draft: EditorDraft, signal: AbortSignal) => Promise<{ version: string } | { failure: NonNullable<EditorDraft['failure']> }>
  readonly guardDraft: (address: string, dirty: boolean) => void
  readonly confirmDiscard: () => boolean
  readonly mount: (container: HTMLElement, options: EditorMountOptions, signal: AbortSignal) => Promise<() => void>
}

/**
 * Register the source editor without changing binary renderers.
 * @param ctx - document registry, Remote calls, and localized copy.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('sidebarEditor', { en, ru, zh }))
  const t = ctx.locale.bind('sidebarEditor')
  ctx.effect(() => ctx.documentPreviews.register({
    id: ID, extensions: [...CODE_HIGHLIGHT_EXTENSIONS.filter(extension => !['csv', 'svg', 'md', 'markdown', 'html', 'htm', 'xhtml'].includes(extension)), 'txt', 'gitignore', 'editorconfig'],
    title: () => t('title'), loading: 'renderer', wrap: true,
  }))
  const store = createEditorStore()
  const dirty = new Set<string>()
  if (typeof window !== 'undefined') ctx.effect(() => {
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (dirty.size === 0) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); dirty.clear() }
  })
  const lifetime = new AbortController()
  let disposeRuntime: (() => void) | undefined
  ctx.effect(() => () => { lifetime.abort(); disposeRuntime?.() })
  let runtime: Promise<typeof import('./runtime.ts')> | undefined
  const theme = { getSnapshot: () => ctx.theme.getTheme(), subscribe: (listener: () => void) => ctx.on('theme/change', listener) }
  const face: EditorInjected = {
    mount: async (container, options, signal) => {
      runtime ??= import('./runtime.ts').then((module) => {
        lifetime.signal.throwIfAborted()
        disposeRuntime = module.installEditorRuntime()
        return module
      })
      const module = await runtime
      signal.throwIfAborted()
      return module.mountEditor(container, options)
    },
    guardDraft: (address, value) => { if (value) dirty.add(address); else dirty.delete(address) },
    confirmDiscard: () => window.confirm(t('confirmDiscard')),
    load: async (address, signal) => {
      const file = hostFileOf(address)
      const read = await ctx.remote.workspaceFiles.readBytes(file.sessionId, file.path, {}, signal)
      if (!read.ok) return 'failed'
      const stat = await ctx.remote.workspaceFiles.stat(file.sessionId, file.path, signal)
      if (!stat.ok) return 'failed'
      if (stat.value.version !== read.value.version || stat.value.absolutePath !== read.value.absolutePath) return 'failed'
      return decodeEditorText(read.value.data, read.value.version) ?? 'unsupported'
    },
    save: async (address, draft, signal) => {
      const file = hostFileOf(address)
      const result = await ctx.remote.workspaceFiles.writeText(file.sessionId, file.path, encodeEditorText(draft), draft.version, signal)
      if (result.ok) return { version: result.value.version }
      switch (result.error.code) {
        case 'workspace-file/stale-version': return { failure: 'conflict' }
        case 'workspace-file/write-denied': return { failure: 'denied' }
        case 'workspace-file/write-failed': return { failure: 'unknown' }
        default: return { failure: 'failed' }
      }
    },
  }
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
    name: 'sidebar.right.tab.document', key: ID, locale: 'sidebarEditor', store,
    inject: () => ({ ...face, hooks: { editorTheme: theme } }),
  }, EditorBody)))
}
