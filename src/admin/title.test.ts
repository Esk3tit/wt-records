import { describe, expect, it } from 'vitest'
import { rightfulHolder } from '#/admin/title'

const at = (iso: string) => new Date(iso)

describe('rightfulHolder', () => {
  it('returns null when there are no candidates', () => {
    expect(rightfulHolder([])).toBeNull()
  })

  it('picks the single candidate', () => {
    expect(rightfulHolder([{ id: 7, kills: 5, verifiedAt: null }])).toBe(7)
  })

  it('picks the highest kills', () => {
    expect(
      rightfulHolder([
        { id: 1, kills: 9, verifiedAt: at('2026-01-01T00:00:00Z') },
        { id: 2, kills: 14, verifiedAt: at('2026-02-01T00:00:00Z') },
        { id: 3, kills: 11, verifiedAt: at('2026-03-01T00:00:00Z') },
      ]),
    ).toBe(2)
  })

  it('breaks a kills tie by earliest verifiedAt (first-to-achieve)', () => {
    expect(
      rightfulHolder([
        { id: 1, kills: 14, verifiedAt: at('2026-03-01T00:00:00Z') },
        { id: 2, kills: 14, verifiedAt: at('2026-01-01T00:00:00Z') },
        { id: 3, kills: 12, verifiedAt: at('2026-01-01T00:00:00Z') },
      ]),
    ).toBe(2)
  })

  it('treats a null verifiedAt as later than any dated verification', () => {
    expect(
      rightfulHolder([
        { id: 1, kills: 14, verifiedAt: null },
        { id: 2, kills: 14, verifiedAt: at('2026-06-01T00:00:00Z') },
      ]),
    ).toBe(2)
  })

  it('breaks a full tie by lowest id for determinism', () => {
    expect(
      rightfulHolder([
        { id: 9, kills: 14, verifiedAt: at('2026-01-01T00:00:00Z') },
        { id: 4, kills: 14, verifiedAt: at('2026-01-01T00:00:00Z') },
      ]),
    ).toBe(4)
  })
})
