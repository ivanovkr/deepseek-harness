// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { apply, inject } from '../src/client/index.ts'
import { OfficialBrandMark, OfficialBrandName } from '../src/client/Brand.tsx'
import { apply as hostApply } from '../src/index.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const BRAND_HOLES = ['sidebar.brand.mark', 'sidebar.brand.name', 'conversation.hero.brand.mark'] as const
const FRAME_HOLE = 'conversation.hero.frame'

async function bench(declare = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const declareHoles = () => slots.register({
    name: 'root',
    children: Object.fromEntries([...BRAND_HOLES, FRAME_HOLE].map(name => [name, {
      kind: name === FRAME_HOLE ? 'hoc' : 'single', scope: 'root',
    }])),
  } as never, () => null)
  const disposeHoles = declare ? declareHoles() : undefined
  return { ctx, slots, declareHoles, disposeHoles }
}

describe('ВСЦМ browser-brand plugin', () => {
  it('keeps the host Loader entry inert and requires only slots', () => {
    expect(hostApply).not.toThrow()
    expect(inject).toEqual(['slots'])
  })

  it('replaces the home mark in local builds without occupying the sidebar or adding whale decoration', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'local')
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    try {
      await fiber.await()
      expect(subject.slots.entries('sidebar.brand.mark')).toHaveLength(0)
      expect(subject.slots.entries('sidebar.brand.name')).toHaveLength(0)
      expect(subject.slots.entries('conversation.hero.brand.mark')).toHaveLength(1)
      expect(subject.slots.entries(FRAME_HOLE)).toHaveLength(0)
    } finally { await fiber.dispose() }
  })

  it('fills declarations before or after apply and removes every occupant on teardown', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'official')
    for (const declared of [true, false]) {
      const subject = await bench(declared)
      const fiber = subject.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      if (!declared) {
        for (const hole of BRAND_HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
        subject.declareHoles()
        await Promise.resolve()
      }
      for (const hole of BRAND_HOLES) expect(subject.slots.entries(hole)).toHaveLength(1)
      expect(subject.slots.entries(FRAME_HOLE)).toHaveLength(0)
      if (declared) {
        subject.disposeHoles?.()
        for (const hole of BRAND_HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
        subject.declareHoles()
        await Promise.resolve()
        for (const hole of BRAND_HOLES) expect(subject.slots.entries(hole)).toHaveLength(1)
      }
      await fiber.dispose()
      for (const hole of BRAND_HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
    }
  })

  it('renders the locale-owned name and supplied artwork at sidebar and hero sizes', () => {
    const name = render(<OfficialBrandName t={() => 'ВСЦМ Harness'} />)
    expect(name.container.textContent).toBe('ВСЦМ Harness')
    expect(name.container.querySelector('svg')).toBeNull()
    name.unmount()
    const mark = render(<OfficialBrandMark size={34} className="hero" />)
    const image = mark.container.querySelector('img')!
    expect(image.getAttribute('src')).toMatch(/vscm-logo\.svg|data:image\/svg\+xml/)
    expect(image.getAttribute('width')).toBe('34')
    expect(image.getAttribute('height')).toBe('34')
    expect(image.alt).toBe('')
    mark.rerender(<OfficialBrandMark size={24} />)
    expect(image.getAttribute('width')).toBe('24')
    expect(image.getAttribute('height')).toBe('24')
  })
})
