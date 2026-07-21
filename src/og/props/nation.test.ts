import { describe, expect, it } from 'vitest'
import { toNationCardModel } from './nation'

describe('toNationCardModel', () => {
  it('carries the site nation-stats numbers and the most-held player', () => {
    const m = toNationCardModel('grb', {
      name: 'USSR',
      nationSlug: 'ussr',
      held: 113,
      total: 182,
      completionPct: 62,
      avgKills: 21.37,
      mostHeldPlayer: 'Пётр',
    })
    expect(m.modeLabel).toBe('GRB')
    expect(m.held).toBe(113)
    expect(m.total).toBe(182)
    expect(m.completionPct).toBe(62)
    expect(m.avgKills).toBe(21.4)
    expect(m.mostHeldPlayer).toBe('Пётр')
  })

  it('tolerates a nation with no records yet', () => {
    const m = toNationCardModel('grb', {
      name: 'Israel',
      nationSlug: 'israel',
      held: 0,
      total: 40,
      completionPct: 0,
      avgKills: null,
      mostHeldPlayer: null,
    })
    expect(m.avgKills).toBeNull()
    expect(m.mostHeldPlayer).toBeNull()
  })
})
