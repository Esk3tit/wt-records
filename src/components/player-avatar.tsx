import { useState } from 'react'
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
  // A key can outlive its object; the Medallion is a first-class state, so a
  // failed load falls back to it rather than to a broken frame. Keyed by URL,
  // so a replacement avatar is tried instead of inheriting the old failure.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const failed = avatarUrl != null && failedUrl === avatarUrl
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {avatarUrl && !failed ? (
        <img
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          width={size}
          height={size}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(avatarUrl)}
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
