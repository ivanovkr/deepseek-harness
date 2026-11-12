/** Account UI availability in the shipped Web composition. */
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { expect, it, onTestFinished } from 'vitest'

it('excludes sign-in and its dependent notifications from the browser roster', async () => {
  const rows = loadOverlayPatches('account-defaults', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))
    .flatMap(patch => patch.insert ?? []).filter(row => row.id === 'ui-settings-account' || row.id === 'ui-account-notifications')
  expect(rows.map(({ id, disabled }) => ({ id, disabled }))).toEqual([
    { id: 'ui-settings-account', disabled: true },
    { id: 'ui-account-notifications', disabled: true },
  ])
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  ctx.baseUrl = 'file:///'
  await ctx.plugin(Loader).await()
  await ctx.loader.root.update(rows)
  await ctx.loader.await()
  for (const row of rows) {
    expect(ctx.loader.resolve(row.id).disabled).toBe(true)
    expect(ctx.loader.resolve(row.id).fiber).toBeUndefined()
  }
})
