/* Vehicle silhouette; renders nothing until the catalog mirror holds the
   image — the row variant keeps its grid slot so row columns stay aligned. */
export function VehicleIcon({
  src,
  variant,
  className = '',
}: {
  src: string | null
  variant?: 'row'
  className?: string
}) {
  if (!src) {
    return variant === 'row' ? (
      <span className="hidden w-0 sm:block" aria-hidden="true" />
    ) : null
  }
  return (
    <img
      src={src}
      alt=""
      className={`vehicle-icon ${variant === 'row' ? 'vehicle-icon-row hidden sm:block' : className}`}
      loading="lazy"
      draggable={false}
    />
  )
}
