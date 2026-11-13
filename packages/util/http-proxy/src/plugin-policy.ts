import type { Dispatcher } from 'undici'
import { proxyRouteFor, type ProxyRoute } from './install.ts'

/** A request's plugin-owned choice between the shared proxy and a direct route. */
export interface PluginProxyPolicy {
  /** Whether requests from this plugin must bypass the shared proxy. */
  readonly bypass: boolean
  /** Stable plugin-entry identity, used only for policy resolution. */
  readonly pluginId: string
}

/** A request-specific route selected without mutating process-wide transport state. */
export type PluginProxyRoute = ProxyRoute | { readonly proxied: false; readonly dispatcher?: Dispatcher }

/** Select the route for one plugin-owned request. */
export function pluginProxyRouteFor(url: URL, policy: PluginProxyPolicy, directDispatcher?: Dispatcher): PluginProxyRoute {
  if (policy.bypass) return directDispatcher === undefined ? { proxied: false } : { proxied: false, dispatcher: directDispatcher }
  return proxyRouteFor(url)
}
