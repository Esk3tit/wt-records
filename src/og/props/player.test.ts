import { describe, expect, it } from 'vitest'
import { toPlayerCardModel } from './player'
import type { PlayerCardData } from './player'

function data(over: Partial<PlayerCardData> = {}): PlayerCardData {
  return {
    player: { displayName: 'Пётр Иванов' },
    records: [
      { mode: 'grb', kills: 21, vehicleName: 'T-34', nationSlug: 'ussr' },
      { mode: 'grb', kills: 34, vehicleName: 'IS-2', nationSlug: 'ussr' },
      { mode: 'grb', kills: 12, vehicleName: 'M4A1', nationSlug: 'usa' },
    ],
    ...over,
  }
}

describe('toPlayerCardModel', () => {
  it('counts current records, best feat, and nations spanned', () => {
    const m = toPlayerCardModel(data())
    expect(m.displayName).toBe('Пётр Иванов')
    expect(m.totalRecords).toBe(3)
    expect(m.perMode).toEqual([{ modeLabel: 'GRB', count: 3 }])
    expect(m.bestVehicle).toBe('IS-2')
    expect(m.bestKills).toBe(34)
    expect(m.nationsSpanned).toBe(2)
    expect(m.previouslyKnownAs).toBeNull()
  })

  it('adds the previously-known-as name on a tombstone card', () => {
    const m = toPlayerCardModel(data(), { previouslyKnownAs: 'OldName' })
    expect(m.previouslyKnownAs).toBe('OldName')
    expect(m.version).toContain('pka')
  })

  it('handles a records-less player without throwing', () => {
    const m = toPlayerCardModel(data({ records: [] }))
    expect(m.totalRecords).toBe(0)
    expect(m.perMode).toEqual([])
    expect(m.bestVehicle).toBeNull()
    expect(m.nationsSpanned).toBe(0)
  })
})
