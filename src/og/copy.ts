import type {
  NationCardModel,
  PlayerCardModel,
  VehicleCardModel,
} from './props/types'

// Unfurl title/description — what a text-only embed or screen reader reads.
// Built from the same model the image renders from, so text and picture agree.

export const SITE_TITLE = 'WT Records'
export const SITE_DESCRIPTION =
  'Community-verified world records for War Thunder — most kills in a single life, per vehicle, per mode.'

export interface Unfurl {
  title: string
  description: string
}

export function vehicleUnfurl(m: VehicleCardModel): Unfurl {
  if (m.kills == null) {
    return {
      title: `${m.vehicleName} — ${m.modeLabel} bounty`,
      description:
        m.minKills != null
          ? `Open bounty — no verified record yet. Minimum to claim it: ${m.minKills} kills.`
          : 'Open bounty — no verified record yet.',
    }
  }
  const parts = [`${m.kills} kills in a single life by ${m.holder}`]
  if (m.br != null) parts.push(`BR ${m.br}`)
  if (m.patch != null) {
    parts.push(`patch ${m.patch}${m.patchName ? ` “${m.patchName}”` : ''}`)
  }
  return {
    title: `${m.vehicleName} — ${m.modeLabel} record`,
    description: parts.join(' · '),
  }
}

export function nationUnfurl(m: NationCardModel): Unfurl {
  const parts = [
    `${m.held} of ${m.total} titles held`,
    `${m.completionPct}% complete`,
  ]
  if (m.avgKills != null) parts.push(`avg ${m.avgKills} kills per record`)
  return {
    title: `${m.nationName} — ${m.modeLabel}`,
    description: parts.join(' · '),
  }
}

export function playerUnfurl(m: PlayerCardModel): Unfurl {
  const parts = [
    `${m.totalRecords} current record${m.totalRecords === 1 ? '' : 's'}`,
    ...m.perMode.map((pm) => `${pm.modeLabel} ${pm.count}`),
  ]
  if (m.previouslyKnownAs)
    parts.push(`previously known as ${m.previouslyKnownAs}`)
  return {
    title: m.displayName,
    description: parts.join(' · '),
  }
}
