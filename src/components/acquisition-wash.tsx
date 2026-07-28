/* Acquisition as the surface's own material: gilded glass for premium, service
   green for squadron. Event and removed stay neutral and speak through chips. */
export function AcquisitionWash({
  tags,
  scale = 'card',
  className = '',
}: {
  tags: { isPremium: boolean; isSquadron: boolean }
  className?: string
  /** `pane` carries the same hue at a quieter strength, because a title sheet
      wears it over an order of magnitude more surface than a card does. */
  scale?: 'card' | 'pane'
}) {
  const material = tags.isPremium
    ? 'acq-premium'
    : tags.isSquadron
      ? 'acq-squadron'
      : null
  if (!material) return null
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-[inherit] ${material} ${scale === 'pane' ? 'acq-pane' : ''} ${className}`}
    />
  )
}
