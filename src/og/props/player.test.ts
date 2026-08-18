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

  it('carries the country code into the model, null by default', () => {
    expect(toPlayerCardModel(data()).countryCode).toBeNull()
    expect(toPlayerCardModel(data(), { countryCode: 'JP' }).countryCode).toBe(
      'JP',
    )
  })

  it('busts the version when the country is set, changed, or cleared', () => {
    const none = toPlayerCardModel(data())
    const jp = toPlayerCardModel(data(), { countryCode: 'JP' })
    const de = toPlayerCardModel(data(), { countryCode: 'DE' })

    expect(jp.version).not.toBe(none.version)
    expect(de.version).not.toBe(jp.version)
    expect(de.version).not.toBe(none.version)
  })

  it('picks the same best record whatever order equal-kill rows arrive in', () => {
    // Two queries of one database state can order a tie either way, and the
    // page and the image route each run their own.
    const tied = [
      { mode: 'grb', kills: 30, vehicleName: 'T-34', nationSlug: 'ussr' },
      { mode: 'grb', kills: 30, vehicleName: 'IS-2', nationSlug: 'ussr' },
    ]
    const one = toPlayerCardModel(data({ records: tied }))
    const other = toPlayerCardModel(data({ records: [...tied].reverse() }))

    // The named winner, not merely the same one twice: picking last is also
    // stable, and would satisfy an equality that names no expected result.
    expect(one.bestVehicle).toBe('IS-2')
    expect(other.bestVehicle).toBe('IS-2')
    expect(one.version).toBe(other.version)
  })

  it('keeps the country in the version on the tombstone path too', () => {
    // The redirect computes the survivor's version itself, so a country left
    // out there sends a scraper to a `?v=` the target does not self-compute.
    const tombstone = { previouslyKnownAs: 'OldName' }
    expect(
      toPlayerCardModel(data(), { ...tombstone, countryCode: 'JP' }).version,
    ).not.toBe(toPlayerCardModel(data(), tombstone).version)
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
