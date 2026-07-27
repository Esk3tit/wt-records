import { describe, expect, it } from 'vitest'
import { rankNations } from './standings'

function nation(
  name: string,
  coveredVehicles: number,
  eligibleVehicles: number,
) {
  return {
    name,
    coveredVehicles,
    eligibleVehicles,
    openBounties: eligibleVehicles - coveredVehicles,
  }
}

const placed = (rows: ReturnType<typeof rankNations>) =>
  rows.map((n) => [n.rank, n.name])

describe('rankNations', () => {
  it('places nations by completion, highest first', () => {
    const rows = rankNations(
      [nation('USA', 150, 157), nation('Italy', 104, 106)],
      true,
    )
    expect(placed(rows)).toEqual([
      [1, 'Italy'],
      [2, 'USA'],
    ])
  })

  it('ranks on the true fraction, not the rounded percentage', () => {
    // Both round to 92%, but 92/100 genuinely outcompletes 100/109 — ordering
    // on the rounded integer would tie them and the held-count key would then
    // put the larger, less complete nation first.
    const rows = rankNations(
      [nation('Larger', 100, 109), nation('Fuller', 92, 100)],
      true,
    )
    expect(placed(rows)).toEqual([
      [1, 'Fuller'],
      [2, 'Larger'],
    ])
  })

  it('breaks a genuine completion tie by titles held', () => {
    const rows = rankNations(
      [nation('Small', 25, 50), nation('Big', 80, 160)],
      true,
    )
    expect(placed(rows)).toEqual([
      [1, 'Big'],
      [2, 'Small'],
    ])
  })

  it('breaks a completion and held-count tie by name', () => {
    const rows = rankNations(
      [nation('Zealand', 40, 80), nation('Albion', 40, 80)],
      true,
    )
    expect(placed(rows)).toEqual([
      [1, 'Albion'],
      [2, 'Zealand'],
    ])
  })

  it('leaves a nation holding nothing unranked, below the placed ones', () => {
    const rows = rankNations(
      [nation('Empty', 0, 90), nation('Held', 10, 100)],
      true,
    )
    expect(placed(rows)).toEqual([
      [1, 'Held'],
      [null, 'Empty'],
    ])
  })

  it('drops places entirely and leads with the biggest prize when uncontested', () => {
    const rows = rankNations(
      [nation('Small', 0, 54), nation('Vast', 0, 195), nation('Mid', 0, 106)],
      false,
    )
    expect(placed(rows)).toEqual([
      [null, 'Vast'],
      [null, 'Mid'],
      [null, 'Small'],
    ])
  })

  it('does not mutate the caller’s array', () => {
    const input = [nation('USA', 1, 10), nation('Italy', 9, 10)]
    rankNations(input, true)
    expect(input.map((n) => n.name)).toEqual(['USA', 'Italy'])
  })
})
