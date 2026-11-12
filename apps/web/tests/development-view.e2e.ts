import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { createChatScrollFixture } from './chat-scroll-fixture.ts'
import { launchWebScaffold, seedSession, watchConsole, type WebScaffold } from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const FIXTURE = createChatScrollFixture({ markerPrefix: 'DEVELOPMENT_VIEW', title: 'Development view session', turns: 1 })
const SEED_ID = 'development-view-web-e2e'

describe('web e2e: Development view', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    await seedSession(scaffold, FIXTURE.log, SEED_ID)
    browser = await chromium.launch()
    page = await newEnglishPage(browser, 900)
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    const search = page.getByRole('button', { name: 'Search sessions' })
    if (await search.getAttribute('aria-expanded') !== 'true') await search.click()
    await page.getByRole('textbox', { name: 'Search session names', exact: true }).fill(FIXTURE.markers.user(1))
    const results = page.getByRole('tree', { name: 'Search results' }).getByRole('treeitem')
    await expect.poll(() => results.count(), { timeout: 60_000 }).toBe(1)
    await results.click()
    await page.getByText(FIXTURE.markers.assistant(1), { exact: false }).last().waitFor({ timeout: 30_000 })
  }, 180_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('shows workspace documents and refreshes their file-derived state', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-development-view'))
    await page.getByRole('tab', { name: 'Development', exact: true }).click()
    await page.getByText('No OpenSpec changes directory in this workspace.', { exact: true }).waitFor({ timeout: 30_000 })
    const changes = join(scaffold.workspaceCwd, 'openspec', 'changes')
    const partial = join(changes, 'partial-change')
    const complete = join(changes, 'complete-change')
    await mkdir(changes, { recursive: true })
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await page.getByText('No active changes.', { exact: true }).waitFor({ timeout: 30_000 })
    await Promise.all([
      mkdir(join(changes, 'empty-change'), { recursive: true }),
      mkdir(partial, { recursive: true }),
      mkdir(join(complete, 'specs', 'example'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(partial, 'proposal.md'), '# Partial proposal\n\nPartial proposal details.\n'),
      writeFile(join(partial, 'tasks.md'), '# Tasks\n\n- [x] Finished fixture task\n- [ ] Pending fixture task\n'),
      writeFile(join(complete, 'proposal.md'), '# Complete proposal\n\nComplete proposal details.\n'),
      writeFile(join(complete, 'design.md'), '# Complete design\n\nComplete design details.\n'),
      writeFile(join(complete, 'tasks.md'), '# Tasks\n\n- [ ] Complete fixture task\n'),
      writeFile(join(complete, 'specs', 'example', 'spec.md'), '# Complete spec\n\nComplete spec details.\n'),
    ])
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await page.getByRole('button', { name: 'partial-change', exact: true }).waitFor({ timeout: 30_000 })
    for (const [heading, change, count] of [
      ['No documents', 'empty-change', '0/4'],
      ['Some documents', 'partial-change', '2/4'],
      ['All document types', 'complete-change', '4/4'],
    ] as const) {
      const card = page.getByRole('region', { name: heading, exact: true }).getByRole('button', { name: change, exact: true })
      await card.waitFor()
      expect(await card.innerText()).toContain(count)
    }

    await page.getByRole('button', { name: 'complete-change', exact: true }).click()
    await page.getByText('Complete proposal details.', { exact: false }).waitFor()
    await page.getByRole('button', { name: /^Specifications\s+1$/ }).click()
    await page.getByText('Complete spec details.', { exact: false }).waitFor()
    await page.getByRole('button', { name: /^Design\s+1$/ }).click()
    await page.getByText('Complete design details.', { exact: false }).waitFor()

    await page.getByRole('button', { name: 'partial-change', exact: true }).click()
    await page.getByRole('button', { name: /^Proposal\s+1$/ }).click()
    await page.getByText('Partial proposal details.', { exact: false }).waitFor()
    await page.getByRole('button', { name: /^Tasks\s+1$/ }).click()
    const tasks = page.getByRole('region', { name: 'Task checkboxes', exact: true })
    const checked = tasks.getByRole('checkbox', { name: 'Checked: Finished fixture task' })
    const unchecked = tasks.getByRole('checkbox', { name: 'Unchecked: Pending fixture task' })
    await checked.waitFor()
    expect(await checked.isChecked()).toBe(true)
    expect(await checked.isDisabled()).toBe(true)
    expect(await unchecked.isChecked()).toBe(false)
    expect(await unchecked.isDisabled()).toBe(true)
    expect(await tasks.innerText()).toContain('1/2')
    await page.getByText('Checkboxes record task text only, not tests or approval.', { exact: true }).waitFor()

    await writeFile(join(partial, 'tasks.md'), '# Tasks\n\n- [x] Refreshed fixture task\n')
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await page.getByText('Refreshed fixture task', { exact: false }).first().waitFor({ timeout: 30_000 })
    expect(await page.getByText('Pending fixture task', { exact: false }).count()).toBe(0)
    expect(tripwire.pageErrors).toEqual([])
  })
})
