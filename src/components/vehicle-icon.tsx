/* Vehicle silhouette; renders nothing until the catalog mirror holds the
   image — the row variant always fills its fixed-width ledger slot. */
export function VehicleIcon({
  src,
  variant,
  className = '',
}: {
  src: string | null
  variant?: 'row'
  className?: string
}) {
  const rowSlot =
    variant === 'row' ? 'vehicle-icon-row hidden @[30rem]:block ' : ''
  if (!src) {
    return variant === 'row' ? (
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
    />
  )
}
