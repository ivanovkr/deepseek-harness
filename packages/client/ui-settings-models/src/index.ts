/** Host configuration and page bootstrap for Models credential onboarding. */

import { installProxyFromEnvironment } from '@deepseek-ai/dsh-http-proxy'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { type Config, ONBOARDING_CONFIG_GLOBAL, validProxyUrl } from './onboarding-config.ts'

export { Config } from './onboarding-config.ts'

/**
 * Apply the shared proxy policy and publish the public credential-onboarding choice.
 * @param ctx - Host context collecting the page's initialization data.
 * @param config - plugin options with schema defaults applied by the Loader.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  await ctx.effect(async () => {
    const install = (url: string) => {
      if (!validProxyUrl(url)) throw new TypeError('Proxy must be an HTTP(S) URL without a path, query, or fragment')
      return installProxyFromEnvironment({
        get: name => ['HTTP_PROXY', 'HTTPS_PROXY'].includes(name) ? { value: url } : undefined,
      }, () => undefined)
    }
    let applied = config.proxyUrl.get()
    let dispose = applied === undefined ? undefined : await install(applied)
    let updates = Promise.resolve()
    ctx.on('loader/volatile-update', () => {
      updates = updates.then(async () => {
        const next = config.proxyUrl.get()
        if (next === applied) return
        await dispose?.()
        dispose = undefined
        applied = undefined
        if (next !== undefined) dispose = await install(next)
        applied = next
      }).catch((_error) => {
        // Transport exceptions may contain proxy credentials; do not log their values.
        ctx.logger.error('Could not apply the configured outbound proxy')
      })
    })
    return async () => {
      await updates
      await dispose?.()
    }
  }, 'models: shared outbound proxy')
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'global',
      name: ONBOARDING_CONFIG_GLOBAL,
      value: { credentialOnboarding: config.credentialOnboarding },
    })
  })
}
