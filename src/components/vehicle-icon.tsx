import { useState } from 'react'

/* Vehicle silhouette. `row` steps aside in a narrow list; `ledger` narrows
   instead of leaving, so a row keeps its face on a phone. */
const SLOTS = {
  row: 'vehicle-icon-row hidden @[30rem]:block ',
  ledger: 'vehicle-icon-ledger ',
} as const

export function VehicleIcon({
  src,
  variant,
  className = '',
}: {
  src: string | null
  variant?: keyof typeof SLOTS
  className?: string
}) {
  // A key can outlive its object (a sync renames ahead of the asset job).
  // Keyed by src so a corrected image is tried, not left hidden.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const rowSlot = variant ? SLOTS[variant] : ''
  if (!src) {
    return variant ? (
      <span className={`${rowSlot}${className}`.trim()} aria-hidden="true" />
    ) : null
  }
  return (
    <img
      src={src}
      alt=""
      className={`vehicle-icon ${rowSlot}${className}`.trim()}
      loading="lazy"
      draggable={false}
      // Hidden, not removed, so the slot keeps its width.
      style={failedSrc === src ? { visibility: 'hidden' } : undefined}
      onError={() => setFailedSrc(src)}
    />
  )
}
