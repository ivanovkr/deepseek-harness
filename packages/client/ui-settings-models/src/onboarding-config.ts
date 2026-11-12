/** Host network settings and public onboarding options. */

import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** Onboarding options after schema defaults are applied. */
export interface Config {
  /** Offer the browser API-key step when no native shell owns credential onboarding. */
  credentialOnboarding: boolean
  /** Shared outbound HTTP(S) proxy; absent retains the launch environment. */
  proxyUrl: Volatile<string | undefined>
  /** Whether TLS certificates on proxied connections must be verified. */
  proxyVerifyTls: Volatile<boolean>
  /** Whether the initial network setup has been acknowledged. */
  proxySetupComplete: Volatile<boolean>
}

/** Validate Host configuration and its public page-bootstrap payload. */
export const Config: z<{ credentialOnboarding?: boolean; proxyUrl?: string; proxyVerifyTls?: boolean; proxySetupComplete?: boolean }, Config> = z.object({
  credentialOnboarding: z.boolean().default(true),
  proxyUrl: z.transform(z.string(), (value) => {
    if (!validProxyUrl(value)) throw new TypeError('Proxy must be an HTTP(S) URL without a path, query, or fragment')
    return value
  }).role('secret').volatile(),
  proxyVerifyTls: z.boolean().default(true).volatile(),
  proxySetupComplete: z.boolean().default(false).volatile(),
})

/** Page-global key carrying only the public onboarding options. */
export const ONBOARDING_CONFIG_GLOBAL = '__DSH_MODELS_ONBOARDING__'

/**
 * Validate a proxy without echoing a URL that may contain credentials.
 * @param value - user-entered HTTP(S) proxy URL.
 * @returns whether the transport can use this proxy endpoint.
 */
export function validProxyUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.hostname !== ''
      && url.pathname === '/' && url.search === '' && url.hash === ''
  } catch (error) {
    // URL parsing is the validation; malformed input remains in the editor.
    if (!(error instanceof TypeError)) throw error
    return false
  }
}
