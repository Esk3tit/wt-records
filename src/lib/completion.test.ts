import { describe, expect, it } from 'vitest'
import { completionPct } from './completion'

describe('completionPct', () => {
  it('rounds the covered/eligible ratio to a percentage', () => {
    expect(completionPct(2, 4)).toBe(50)
    expect(completionPct(1, 3)).toBe(33)
    expect(completionPct(4, 4)).toBe(100)
  })

  it('is 0 when nothing is eligible, never NaN or Infinity', () => {
    expect(completionPct(0, 0)).toBe(0)
    expect(completionPct(3, 0)).toBe(0)
  })
})
