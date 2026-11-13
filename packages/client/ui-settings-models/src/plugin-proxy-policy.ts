import z from '@deepseek-ai/schemastery'

/** Policy read by request-owning plugins; missing identity or configuration keeps the shared proxy. */
export function shouldPluginBypassProxy(ids: readonly string[] | undefined, pluginId: string | undefined): boolean {
  return pluginId !== undefined && ids?.includes(pluginId) === true
}

/** Schema for the plugin ids that bypass the shared proxy, empty by default. */
export const PluginProxyConfig = z.object({
  proxyBypassPluginIds: z.array(z.string()).default([]).volatile(),
})
