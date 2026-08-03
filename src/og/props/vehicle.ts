import { formatBr } from '#/lib/format'
import { standingKills, titleBar } from '#/lib/rules'
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
    portrait: string | null
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
  /** Every verified life, for the score a vacant title still carries. */
  history: Array<{ kills: number }>
}

export function toVehicleCardModel(
  mode: string,
  data: VehicleCardData,
): VehicleCardModel {
  const { vehicle, br, current, minKills } = data
  // The card quotes the same bar the deed does, or a share preview would
  // advertise a score the write path refuses.
  const standing = standingKills(
    current?.kills ?? null,
    data.history.map((h) => h.kills),
  )
  const bar = titleBar(standing, minKills, current != null)
  // Verified records outlive their holder, so a vacated title has a score the
  // card must not deny — and only that case carries the field.
  const vacated = current == null && standing != null

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
    minKills: current == null ? bar.kills : minKills,
    ...(vacated ? { standing } : {}),
    artUrl: vehicle.portrait,
  }
  return { ...base, version: contentVersion(base) }
}
