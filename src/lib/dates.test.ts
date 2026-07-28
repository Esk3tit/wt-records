import { describe, expect, it } from 'vitest'
import { formatHeldDays, stoodDays } from '#/lib/dates'

const DAY = 86_400

describe('formatHeldDays', () => {
  it('counts whole days, thousands separated', () => {
    expect(formatHeldDays(412 * DAY)).toBe('412 days')
    expect(formatHeldDays(1_200 * DAY + 3_600)).toBe('1,200 days')
  })

  it('keeps the singular day singular', () => {
    expect(formatHeldDays(DAY)).toBe('1 day')
    expect(formatHeldDays(2 * DAY - 1)).toBe('1 day')
  })

  it('never reports a reign as zero', () => {
    expect(formatHeldDays(0)).toBe('under a day')
    expect(formatHeldDays(3_600)).toBe('under a day')
  })
})

describe('stoodDays', () => {
  const at = (iso: string) => new Date(iso)

  it('counts whole days between a record and the one that took it', () => {
    expect(
      stoodDays(at('2024-04-12T00:00:00Z'), at('2024-11-12T00:00:00Z')),
    ).toBe(214)
  })

  it('reports a same-day supersede as a real reign, not a zero', () => {
    expect(
      stoodDays(at('2024-04-12T01:00:00Z'), at('2024-04-12T20:00:00Z')),
    ).toBe(0)
  })

  it('has no span when either end is unknown', () => {
    expect(stoodDays(null, at('2024-11-12T00:00:00Z'))).toBeNull()
    expect(stoodDays(at('2024-04-12T00:00:00Z'), null)).toBeNull()
  })

  it('accepts the serialized string form loader data arrives in', () => {
    expect(stoodDays('2024-04-12T00:00:00Z', '2024-04-22T00:00:00Z')).toBe(10)
  })
})
