import { Medallion } from '#/components/medallion'

/* A Player's face in the hall: the site-owned avatar when set, otherwise the
   Medallion. A lit, hairline-ringed disc — a floating object, not a boxed
   thumbnail. Size is the rendered diameter; `sizes`/eager tune the one large
   profile instance vs. small inline uses. */
export function PlayerAvatar({
  avatarUrl,
  displayName,
  size = 72,
  eager = false,
}: {
  avatarUrl: string | null
  displayName: string
  size?: number
  eager?: boolean
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          width={size}
          height={size}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <Medallion name={displayName} />
      )}
      {/* Hairline ring + inset top highlight: the disc reads as lit glass,
          consistent in both lighting states, over any avatar or Medallion. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow:
            'inset 0 0 0 1px var(--hairline), inset 0 1.5px 0 var(--glass-highlight)',
        }}
      />
    </div>
  )
}
