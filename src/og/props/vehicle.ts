import { formatBr } from '#/lib/format'
import { classLabel } from '#/lib/vehicle-classes'
import type { CardChip, VehicleCardModel } from './types'
import { contentVersion } from './version'

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

export function toVehicleCardModel(
  mode: string,
  data: VehicleCardData,
): VehicleCardModel {
  const { vehicle, br, current, minKills } = data

  // Same chip set as the site's vehicle surfaces: class, BR, the acquisition
  // stack, Removed last.
  const chips: CardChip[] = [{ label: classLabel(vehicle.class) }]
  if (br != null) chips.push({ label: `BR ${formatBr(br)}` })
  if (vehicle.isEvent) chips.push({ label: 'event' })
  if (vehicle.isPremium) chips.push({ label: 'premium' })
  if (vehicle.isSquadron) chips.push({ label: 'squadron' })
  if (vehicle.isRemoved) chips.push({ label: 'removed' })

  const base = {
    kind: 'vehicle' as const,
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
  }
  return { ...base, version: contentVersion(base) }
}
