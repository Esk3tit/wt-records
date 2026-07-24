import { describe, expect, it } from 'vitest'
import { formatHeldDays } from '#/lib/dates'

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
