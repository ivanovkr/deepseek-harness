/** OpenSpec standard-layout development view and read-only resources. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-workspace-files/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Config } from './config.ts'
import { DevelopmentView, type DevelopmentInjected } from './DevelopmentView.tsx'
import { boardAddress, createDevelopmentResources } from './resources.ts'
import { en, zh, ru, ja, es, fr, de, pt, type DevelopmentKey } from './locales.ts'

export { Config } from './config.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy owned by the OpenSpec document inventory. */
    development: DevelopmentKey
  }
}

/** Required registries and existing file RPC methods. */
export const inject = ['slots', 'locale', 'resources', 'remote.workspaceFiles']

/** Register contributions for this plugin fiber's lifetime.
 * @param ctx - Injected client context.
 * @param config - Validated discovery and retention budgets.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.locale.register('development', { en, zh, ru, ja, es, fr, de, pt }))
  const t = ctx.locale.bind('development')
  const resources = createDevelopmentResources(ctx.remote.workspaceFiles, config)
  ctx.effect(() => ctx.resources.register(resources.board))
  ctx.effect(() => ctx.resources.register(resources.document))
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'development', order: 30, locale: 'development', label: () => t('title'),
    inject: (sessionId: SessionId): DevelopmentInjected => ({ sessionId, boardAddress: boardAddress(sessionId), refresh: () => resources.refresh(sessionId) }),
  }, DevelopmentView))
}
