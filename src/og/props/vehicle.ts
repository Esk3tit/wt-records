import { formatBr } from '#/lib/format'
import type { CardChip, VehicleCardModel } from './types'

export interface VehicleCardData {
  vehicle: {
    name: string
    class: string
    nationSlug: string
    nationName: string
    isEvent: boolean
    isPremium: boolean
    isSquadron: boolean
    isRemoved: boolean
    image: string | null
  }
  br: number | null
  current: {
    kills: number
    patch: string
    patchName: string | null
    verifiedAt: Date | string | null
    displayName: string
  } | null
  minKills: number | null
}

function classLabel(c: string): string {
  return c.charAt(0).toUpperCase() + c.slice(1)
}

function versionToken(v: Date | string | null): string {
  if (v == null) return 'mig'
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t.toString(36) : 'mig'
}

export function toVehicleCardModel(
  mode: string,
  data: VehicleCardData,
): VehicleCardModel {
  const { vehicle, br, current, minKills } = data

  // Chip order mirrors the site's vehicle surfaces exactly: class, BR, then the
  // acquisition stack, Removed last.
  const chips: CardChip[] = [
    { label: classLabel(vehicle.class), tone: 'neutral' },
  ]
  if (br != null) chips.push({ label: `BR ${formatBr(br)}`, tone: 'neutral' })
  if (vehicle.isEvent) chips.push({ label: 'event', tone: 'neutral' })
  if (vehicle.isPremium) chips.push({ label: 'premium', tone: 'neutral' })
  if (vehicle.isSquadron) chips.push({ label: 'squadron', tone: 'neutral' })
  if (vehicle.isRemoved) chips.push({ label: 'removed', tone: 'removed' })

  const version = current
    ? `r${versionToken(current.verifiedAt)}-${current.kills}`
    : `open-${minKills ?? 0}`

  return {
    kind: 'vehicle',
    modeLabel: mode.toUpperCase(),
    vehicleName: vehicle.name,
    nationSlug: vehicle.nationSlug,
    chips,
    kills: current ? current.kills : null,
    holder: current ? current.displayName : null,
    br: br != null ? formatBr(br) : null,
    patch: current ? current.patch : null,
    patchName: current ? current.patchName : null,
    minKills,
    artUrl: vehicle.image,
    version,
  }
}
