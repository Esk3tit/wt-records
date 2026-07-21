import type { PlayerCardModel, PlayerModeCount } from './types'
import { contentVersion } from './version'

export interface PlayerCardData {
  player: { displayName: string }
  records: Array<{
    mode: string
    kills: number
    vehicleName: string
    nationSlug: string
  }>
}

export function toPlayerCardModel(
  data: PlayerCardData,
  opts: { previouslyKnownAs?: string | null } = {},
): PlayerCardModel {
  const { records } = data

  // Per-mode counts in first-seen order (records arrive mode-ascending).
  const counts = new Map<string, number>()
  for (const r of records) counts.set(r.mode, (counts.get(r.mode) ?? 0) + 1)
  const perMode: PlayerModeCount[] = [...counts].map(([mode, count]) => ({
    modeLabel: mode.toUpperCase(),
    count,
  }))

  let best: (typeof records)[number] | null = null
  for (const r of records) if (!best || r.kills > best.kills) best = r

  const nationsSpanned = new Set(records.map((r) => r.nationSlug)).size

  const base = {
    kind: 'player' as const,
    displayName: data.player.displayName,
    totalRecords: records.length,
    perMode,
    bestVehicle: best ? best.vehicleName : null,
    bestKills: best ? best.kills : null,
    nationsSpanned,
    previouslyKnownAs: opts.previouslyKnownAs ?? null,
  }
  return { ...base, version: contentVersion(base) }
}
