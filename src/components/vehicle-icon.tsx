/* Vehicle silhouette; renders nothing until the catalog mirror holds the image.
   `row` fills a fixed-width slot in wide lists and steps aside when the list is
   narrow; `ledger` keeps its slot at every width, narrowing instead of leaving,
   because a ledger row is the vehicle and should carry its face on a phone. */
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
      // A key can outlive its mirrored object (a catalog sync can rename one
      // ahead of the asset job). Hidden, not removed: the row slot keeps its
      // width so names stay on one edge either way.
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}
