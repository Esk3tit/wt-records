import { describe, expect, it } from 'vitest'
import { nationUnfurl, playerUnfurl, vehicleUnfurl } from './copy'
import { toVehicleCardModel } from './props/vehicle'
import { toNationCardModel } from './props/nation'
import { toPlayerCardModel } from './props/player'

describe('vehicleUnfurl', () => {
  const held = toVehicleCardModel('grb', {
    vehicle: {
      name: 'M4A1 Sherman',
      class: 'medium',
      nationSlug: 'usa',
      nationName: 'USA',
      isEvent: false,
      isPremium: false,
      isSquadron: false,
      isRemoved: false,
      image: null,
    },
    br: 5.7,
    current: {
      kills: 21,
      patch: '2.31',
      patchName: 'Kings of Battle',
      verifiedAt: '2026-07-01',
      displayName: 'Пётр',
    },
    minKills: 15,
  })

  it('tells the whole story in the description for a held record', () => {
    const u = vehicleUnfurl(held)
    expect(u.title).toBe('M4A1 Sherman — GRB record')
    expect(u.description).toBe(
      '21 kills in a single life by Пётр · BR 5.7 · patch 2.31 “Kings of Battle”',
    )
  })

  it('turns the Open bounty card into a call to action', () => {
    const open = toVehicleCardModel('grb', {
      vehicle: {
        name: 'Object 279',
        class: 'heavy',
        nationSlug: 'ussr',
        nationName: 'USSR',
        isEvent: true,
        isPremium: false,
        isSquadron: false,
        isRemoved: false,
        image: null,
      },
      br: 8.0,
      current: null,
      minKills: 18,
    })
    const u = vehicleUnfurl(open)
    expect(u.title).toBe('Object 279 — GRB bounty')
    expect(u.description).toBe(
      'Open bounty — no verified record yet. Minimum to claim it: 18 kills.',
    )
  })
})

describe('nationUnfurl', () => {
  it('reads the nation-sheet progress in text', () => {
    const u = nationUnfurl(
      toNationCardModel('grb', {
        name: 'USSR',
        nationSlug: 'ussr',
        held: 113,
        total: 182,
        completionPct: 62,
        avgKills: 21.37,
        mostHeldPlayer: 'Пётр',
      }),
    )
    expect(u.title).toBe('USSR — GRB')
    expect(u.description).toBe(
      '113 of 182 titles held · 62% complete · avg 21.4 kills per record',
    )
  })
})

describe('playerUnfurl', () => {
  const model = toPlayerCardModel({
    player: { displayName: 'Пётр Иванов' },
    records: [
      { mode: 'grb', kills: 34, vehicleName: 'IS-2', nationSlug: 'ussr' },
      { mode: 'grb', kills: 12, vehicleName: 'M4A1', nationSlug: 'usa' },
    ],
  })

  it('is titled by the display name and counts records per mode', () => {
    const u = playerUnfurl(model)
    expect(u.title).toBe('Пётр Иванов')
    expect(u.description).toBe('2 current records · GRB 2')
  })

  it('appends the previously-known-as clause on a tombstone', () => {
    const u = playerUnfurl(
      toPlayerCardModel(
        { player: { displayName: 'Пётр Иванов' }, records: [] },
        { previouslyKnownAs: 'OldPetya' },
      ),
    )
    expect(u.description).toBe(
      '0 current records · previously known as OldPetya',
    )
  })
})
