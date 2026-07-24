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
    // The tombstone name is rendered, so it must bust the cache.
    expect(m.version).not.toBe(toPlayerCardModel(data()).version)
  })

  it('busts the version on a rename or best-record swap at the same count', () => {
    const base = toPlayerCardModel(data())
    const renamed = toPlayerCardModel({
      ...data(),
      player: { displayName: 'Renamed' },
    })
    expect(renamed.version).not.toBe(base.version)
  })

  it('handles a records-less player without throwing', () => {
    const m = toPlayerCardModel(data({ records: [] }))
    expect(m.totalRecords).toBe(0)
    expect(m.perMode).toEqual([])
    expect(m.bestVehicle).toBeNull()
    expect(m.nationsSpanned).toBe(0)
  })

  it('carries the effective avatar key into the model, null by default', () => {
    expect(toPlayerCardModel(data()).avatarKey).toBeNull()
    expect(
      toPlayerCardModel(data(), { avatarKey: 'avatars/42/abc.webp' }).avatarKey,
    ).toBe('avatars/42/abc.webp')
  })

  it('busts the version when the avatar is set, replaced, or removed', () => {
    const medallion = toPlayerCardModel(data())
    const set = toPlayerCardModel(data(), { avatarKey: 'avatars/42/abc.webp' })
    const replaced = toPlayerCardModel(data(), {
      avatarKey: 'avatars/42/def.webp',
    })

    // set (Medallion → avatar), replace (avatar → different avatar), and remove
    // (avatar → Medallion) each yield a distinct URL, so caches can't go stale.
    expect(set.version).not.toBe(medallion.version)
    expect(replaced.version).not.toBe(set.version)
    expect(medallion.version).not.toBe(replaced.version)
  })
})
