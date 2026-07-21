import type { NationCardModel } from './types'

export interface NationCardData {
  name: string
  nationSlug: string
  held: number
  total: number
  completionPct: number
  avgKills: number | null
  mostHeldPlayer: string | null
}

export function toNationCardModel(
  mode: string,
  data: NationCardData,
): NationCardModel {
  const avg = data.avgKills != null ? Math.round(data.avgKills * 10) / 10 : null
  return {
    kind: 'nation',
    modeLabel: mode.toUpperCase(),
    nationName: data.name,
    nationSlug: data.nationSlug,
    held: data.held,
    total: data.total,
    completionPct: data.completionPct,
    avgKills: avg,
    mostHeldPlayer: data.mostHeldPlayer,
    version: `n${data.held}-${data.completionPct}-${avg ?? 0}`,
  }
}
