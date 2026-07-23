import { useId } from 'react'
import { monogram } from '#/lib/monogram'

/* The Medallion: the designed identity mark for any Player without an Avatar —
   a first-class state, not a placeholder. An engraved, lit disc carrying the
   Player's monogram; chroma-neutral, since metals belong to ranks alone. */
export function Medallion({ name }: { name: string }) {
  const id = useId()
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full"
      role="img"
      aria-label={`${name} — no avatar set`}
    >
      <defs>
        {/* Lit from above, like every glass surface in the hall. */}
        <radialGradient id={`${id}-face`} cx="50%" cy="32%" r="78%">
          <stop offset="0%" stopColor="var(--glass-highlight)" />
          <stop offset="45%" stopColor="var(--tint-strong)" />
          <stop offset="100%" stopColor="var(--tint)" />
        </radialGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="48.5"
        fill={`url(#${id}-face)`}
        stroke="var(--hairline)"
        strokeWidth="1.5"
      />
      {/* The engraved inner ring that makes it read as a struck medallion. */}
      <circle
        cx="50"
        cy="50"
        r="41"
        fill="none"
        stroke="var(--hairline-soft)"
        strokeWidth="1"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="33"
        fontWeight="600"
        letterSpacing="0.01em"
        fill="var(--ink-muted)"
      >
        {monogram(name)}
      </text>
    </svg>
  )
}
