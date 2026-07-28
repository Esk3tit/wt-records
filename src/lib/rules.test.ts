import { describe, expect, it } from 'vitest'
import {
  qualifies,
  qualifyingThreshold,
  takesTitle,
  standingKills,
  titleBar,
  titleReigns,
} from '#/lib/rules'
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

describe('titleBar (the number to beat)', () => {
  it('a held title states one more than the standing record', () => {
    expect(titleBar(23, 12)).toEqual({ held: true, kills: 24 })
  })

  it('the held bar ignores the qualifying minimum entirely', () => {
    // a record below its own class bar (migrated corpus) still only needs
    // to be strictly exceeded — the qualifying bar gates new titles, not this
    expect(titleBar(4, 12)).toEqual({ held: true, kills: 5 })
  })

  it('an open bounty states the class qualifying minimum', () => {
    expect(titleBar(null, 12)).toEqual({ held: false, kills: 12 })
  })

  it('an open bounty with no configured bar states no number', () => {
    expect(titleBar(null, null)).toEqual({ held: false, kills: null })
  })
})

describe('standingKills (what a challenger must actually exceed)', () => {
  it('is the standing record when nothing outranks it', () => {
    expect(standingKills(30, [10, 30])).toBe(30)
  })

  // recomputeTitle awards the title to the highest verified record on the next
  // write, so an override to a lower holder must not lower the bar.
  it('is the highest verified record, not an overridden lower holder', () => {
    expect(standingKills(20, [10, 30, 20])).toBe(30)
  })

  it('is null for a title nobody has ever taken', () => {
    expect(standingKills(null, [])).toBeNull()
  })
})

describe('titleReigns', () => {
  const at = (iso: string) => new Date(iso)
  const r = (kills: number, iso: string | null) => ({
    kills,
    verifiedAt: iso ? at(iso) : null,
  })

  it('gives every climbing record a reign closed by the one that took it', () => {
    const { reigns: out } = titleReigns([
      r(10, '2024-01-01T00:00:00Z'),
      r(12, '2024-01-11T00:00:00Z'),
      r(20, '2024-02-01T00:00:00Z'),
    ])
    expect(out.map((x) => x.heldTitle)).toEqual([true, true, true])
    expect(out[0].endedAt).toEqual(at('2024-01-11T00:00:00Z'))
    expect(out[1].endedAt).toEqual(at('2024-02-01T00:00:00Z'))
    expect(out[2].endedAt).toBeNull()
  })

  // The migrated corpus carries verified rows that never beat the standing
  // record — they are real lives, but they never held the title.
  it('never lets a losing record hold a title or close another reign', () => {
    const { reigns: out } = titleReigns([
      r(10, '2024-01-01T00:00:00Z'),
      r(9, '2024-01-05T00:00:00Z'),
      r(20, '2024-02-01T00:00:00Z'),
    ])
    expect(out.map((x) => x.heldTitle)).toEqual([true, false, true])
    // the 10 was taken by the 20, NOT by the losing 9 four days later
    expect(out[0].endedAt).toEqual(at('2024-02-01T00:00:00Z'))
    expect(out[1].endedAt).toBeNull()
  })

  it('does not let an equal score take the title (takesTitle is strict)', () => {
    const { reigns: out } = titleReigns([
      r(10, '2024-01-01T00:00:00Z'),
      r(10, '2024-01-05T00:00:00Z'),
    ])
    expect(out.map((x) => x.heldTitle)).toEqual([true, false])
    expect(out[0].endedAt).toBeNull()
  })

  it('treats a dateless migrated record as the oldest, per the loader order', () => {
    const { reigns } = titleReigns([r(10, null), r(20, '2024-02-01T00:00:00Z')])
    expect(reigns[0].heldTitle).toBe(true)
    expect(reigns[0].endedAt).toEqual(at('2024-02-01T00:00:00Z'))
  })

  // makeCurrentRecord lets a moderator hand the title to a record the kill
  // frontier does not end on. The rows then cannot say who held what when.
  it('reports the chronology as unknown when the current row is not the frontier tip', () => {
    const { chronologyKnown } = titleReigns([
      { ...r(10, '2024-01-01T00:00:00Z'), isCurrent: false },
      { ...r(30, '2024-02-01T00:00:00Z'), isCurrent: false },
      { ...r(20, '2024-03-01T00:00:00Z'), isCurrent: true },
    ])
    expect(chronologyKnown).toBe(false)
  })

  it('reports the chronology as known when the frontier tip holds the title', () => {
    const { chronologyKnown } = titleReigns([
      { ...r(10, '2024-01-01T00:00:00Z'), isCurrent: false },
      { ...r(30, '2024-02-01T00:00:00Z'), isCurrent: true },
    ])
    expect(chronologyKnown).toBe(true)
  })

  it('says nothing about chronology when no row claims to be current', () => {
    const { chronologyKnown } = titleReigns([
      r(10, '2024-01-01T00:00:00Z'),
      r(30, '2024-02-01T00:00:00Z'),
    ])
    expect(chronologyKnown).toBe(true)
  })
})
