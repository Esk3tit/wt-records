import { describe, expect, it } from 'vitest'
import { qualifies, qualifyingThreshold, takesTitle } from '#/lib/rules'
import type { ModeThresholds, VehicleClass } from '#/lib/rules'

const grb: ModeThresholds = {
  minKillsByClass: { light: 8, medium: 10, heavy: 10, spg: 7, spaa: 6 },
  difficultMinKills: 5,
}

describe('qualifyingThreshold', () => {
  it('uses the class minimum for a normal vehicle', () => {
    expect(qualifyingThreshold('medium', false, grb)).toBe(10)
    expect(qualifyingThreshold('spaa', false, grb)).toBe(6)
  })

  it('uses the difficult override for a difficult vehicle', () => {
    expect(qualifyingThreshold('heavy', true, grb)).toBe(5)
  })

  it('falls back to the class minimum when difficult override is unset', () => {
    expect(
      qualifyingThreshold('medium', true, { ...grb, difficultMinKills: null }),
    ).toBe(10)
  })

  it('is null when the class has no configured minimum', () => {
    expect(qualifyingThreshold('fighter', false, grb)).toBeNull()
  })

  it('is null for a difficult vehicle when neither the override nor the class baseline is set', () => {
    // difficult, but the mode has no difficult override AND the class has no minimum
    expect(
      qualifyingThreshold('fighter', true, { ...grb, difficultMinKills: null }),
    ).toBeNull()
  })
})

describe('qualifies', () => {
  // The five GRB-configured ground classes, with their baselines.
  const configured: Array<[VehicleClass, number]> = [
    ['light', 8],
    ['medium', 10],
    ['heavy', 10],
    ['spg', 7],
    ['spaa', 6],
  ]
  it.each(configured)(
    'normal %s: meets-or-exceeds the class min %d',
    (cls, bar) => {
      expect(qualifies(bar - 1, cls, false, grb)).toBe(false)
      expect(qualifies(bar, cls, false, grb)).toBe(true)
      expect(qualifies(bar + 1, cls, false, grb)).toBe(true)
    },
  )

  // The rest of the VehicleClass surface has no GRB baseline → never qualifies.
  const unconfigured: Array<VehicleClass> = [
    'fighter',
    'attacker',
    'bomber',
    'heli',
    'other',
  ]
  it.each(unconfigured)(
    'unconfigured %s never qualifies (no baseline)',
    (cls) => {
      expect(qualifies(99, cls, false, grb)).toBe(false)
    },
  )

  it('difficult vehicle uses the lower difficult bar', () => {
    // heavy normally needs 10, but as a difficult vehicle only needs 5
    expect(qualifies(5, 'heavy', true, grb)).toBe(true)
    expect(qualifies(4, 'heavy', true, grb)).toBe(false)
  })
})

describe('takesTitle (supersede rule)', () => {
  it('strictly exceeding the incumbent takes the title', () => {
    expect(takesTitle(11, 10)).toBe(true)
  })

  it('an EQUAL score does NOT supersede — first-to-achieve keeps it', () => {
    expect(takesTitle(10, 10)).toBe(false)
  })

  it('a lower score does not supersede', () => {
    expect(takesTitle(9, 10)).toBe(false)
  })

  it('takes an open (unclaimed) vehicle', () => {
    expect(takesTitle(1, null)).toBe(true)
  })
})
