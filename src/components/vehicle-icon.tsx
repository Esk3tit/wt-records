/* Tiny inline vehicle silhouette — identification for a game full of
   copy-paste vehicles, decorative markup-wise (the name is always adjacent).
   Renders nothing until the catalog mirror holds the image. */
export function VehicleIcon({
  src,
  className = '',
}: {
  src: string | null
  className?: string
}) {
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      className={`vehicle-icon ${className}`}
      loading="lazy"
      draggable={false}
    />
  )
}
