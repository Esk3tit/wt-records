import { describe, expect, it } from 'vitest'
import { toVehicleCardModel } from './vehicle'
import type { VehicleCardData } from './vehicle'

function data(over: Partial<VehicleCardData> = {}): VehicleCardData {
  return {
    vehicle: {
      name: 'M4A1 Sherman',
      class: 'medium',
      nationSlug: 'usa',
      nationName: 'USA',
      isEvent: false,
      isPremium: false,
      isSquadron: false,
      isRemoved: false,
      image: 'https://cdn.example/usa/sherman.png',
      ...over.vehicle,
    },
    br: 5.7,
    current: {
      kills: 21,
      patch: '2.31',
      patchName: 'Kings of Battle',
      verifiedAt: '2026-07-01T00:00:00.000Z',
      displayName: 'Пётр',
    },
    minKills: 15,
    ...over,
  }
}

describe('toVehicleCardModel', () => {
  it('maps a held record with the class + BR chips first', () => {
    const m = toVehicleCardModel('grb', data())
    expect(m.modeLabel).toBe('GRB')
    expect(m.kills).toBe(21)
    expect(m.holder).toBe('Пётр')
    expect(m.br).toBe('5.7')
    expect(m.chips.map((c) => c.label)).toEqual(['Medium', 'BR 5.7'])
    expect(m.artUrl).toBe('https://cdn.example/usa/sherman.png')
  })

  it('stacks acquisition chips and Removed last, tagging Removed tone', () => {
    const m = toVehicleCardModel(
      'grb',
      data({
        vehicle: {
          ...data().vehicle,
          isPremium: true,
          isRemoved: true,
        },
      }),
    )
    expect(m.chips.map((c) => c.label)).toEqual([
      'Medium',
      'BR 5.7',
      'premium',
      'removed',
    ])
  })

  it('represents an Open bounty as null kills with the qualifying threshold', () => {
    const m = toVehicleCardModel('grb', data({ current: null }))
    expect(m.kills).toBeNull()
    expect(m.holder).toBeNull()
    expect(m.minKills).toBe(15)
    expect(m.version).toBeTruthy()
  })

  it('upper-cases SPG/SPAA class acronyms in the chip', () => {
    const spaa = toVehicleCardModel(
      'grb',
      data({ vehicle: { ...data().vehicle, class: 'spaa' } }),
    )
    expect(spaa.chips[0].label).toBe('SPAA')
  })

  it('busts the version when any rendered field changes, not just the record', () => {
    const base = toVehicleCardModel('grb', data())
    const renamedHolder = toVehicleCardModel(
      'grb',
      data({ current: { ...data().current!, displayName: 'Renamed' } }),
    )
    const changedBr = toVehicleCardModel('grb', data({ br: 6.7 }))
    expect(renamedHolder.version).not.toBe(base.version)
    expect(changedBr.version).not.toBe(base.version)
  })

  it('keeps the card art-less when no image is mirrored', () => {
    const m = toVehicleCardModel(
      'grb',
      data({ vehicle: { ...data().vehicle, image: null } }),
    )
    expect(m.artUrl).toBeNull()
  })

  it('busts the version when the record changes', () => {
    const a = toVehicleCardModel('grb', data())
    const b = toVehicleCardModel(
      'grb',
      data({ current: { ...data().current!, kills: 22 } }),
    )
    expect(a.version).not.toBe(b.version)
  })
})
