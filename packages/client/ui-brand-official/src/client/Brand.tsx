import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import vscmLogo from './assets/vscm-logo.svg'

/**
 * Render the ВСЦМ mark at the host's requested size.
 * @param props - Host-supplied mark presentation.
 * @returns the decorative brand image.
 */
export function OfficialBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <img src={vscmLogo} width={size} height={size} className={className} alt="" />
}

/**
 * Render the localized product name separately from its mark.
 * @param props - Common product-title dictionary.
 * @returns the product name.
 */
export function OfficialBrandName({ t }: PropsLocale<'common'>) {
  return <span>{t('brand.localBuild')}</span>
}
