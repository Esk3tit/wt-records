import type { ReactNode } from 'react'

/* Hand-drawn simplified national flags, tuned to read at chip size (14–20px).
   Decorative by contract: the nation name is always adjacent text, so the
   flag carries aria-hidden and never any text alternative of its own. */

const W = 30
const H = 20

const FLAGS: Record<string, ReactNode> = {
  usa: (
    <>
      <rect width={W} height={H} fill="#B22234" />
      {[1, 3, 5, 7, 9].map((i) => (
        <rect key={i} y={(H / 11) * i} width={W} height={H / 11} fill="#fff" />
      ))}
      <rect width={13} height={(H / 11) * 6} fill="#3C3B6E" />
    </>
  ),
  germany: (
    <>
      <rect width={W} height={H} fill="#000" />
      <rect y={H / 3} width={W} height={H / 3} fill="#DD0000" />
      <rect y={(H / 3) * 2} width={W} height={H / 3} fill="#FFCE00" />
    </>
  ),
  ussr: (
    <>
      <rect width={W} height={H} fill="#CC0000" />
      <path
        d="M7.2 3.4l.75 1.7 1.85.14-1.4 1.2.44 1.8-1.64-.97-1.64.97.44-1.8-1.4-1.2 1.85-.14z"
        fill="#FFD700"
      />
      <path
        d="M11.6 13.9a5 5 0 0 1-7.1-6.4 5.6 5.6 0 1 0 7.1 6.4z"
        fill="#FFD700"
      />
      <rect
        x={5.1}
        y={8.2}
        width={7.4}
        height={1.5}
        rx={0.3}
        fill="#FFD700"
        transform="rotate(45 8.8 8.9)"
      />
    </>
  ),
  britain: (
    <>
      <rect width={W} height={H} fill="#012169" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth={4} />
      <path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" strokeWidth={1.6} />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth={6.6} />
      <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth={4} />
    </>
  ),
  japan: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx={15} cy={10} r={6} fill="#BC002D" />
    </>
  ),
  china: (
    <>
      <rect width={W} height={H} fill="#DE2910" />
      <path
        d="M6 3l1.06 2.4 2.62.2-1.98 1.7.62 2.55L6 8.45 3.68 9.85l.62-2.55-1.98-1.7 2.62-.2z"
        fill="#FFDE00"
      />
      {[
        [11.5, 2.2],
        [13.3, 4.4],
        [13.3, 7.2],
        [11.5, 9.4],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1} fill="#FFDE00" />
      ))}
    </>
  ),
  italy: (
    <>
      <rect width={W / 3} height={H} fill="#008C45" />
      <rect x={W / 3} width={W / 3} height={H} fill="#fff" />
      <rect x={(W / 3) * 2} width={W / 3} height={H} fill="#CD212A" />
    </>
  ),
  france: (
    <>
      <rect width={W / 3} height={H} fill="#002395" />
      <rect x={W / 3} width={W / 3} height={H} fill="#fff" />
      <rect x={(W / 3) * 2} width={W / 3} height={H} fill="#ED2939" />
    </>
  ),
  sweden: (
    <>
      <rect width={W} height={H} fill="#006AA7" />
      <rect x={9} width={4} height={H} fill="#FECC02" />
      <rect y={8} width={W} height={4} fill="#FECC02" />
    </>
  ),
  israel: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <rect y={2} width={W} height={2.6} fill="#0038B8" />
      <rect y={15.4} width={W} height={2.6} fill="#0038B8" />
      <path
        d="M15 5.6l3.4 5.9h-6.8zM15 14.4l3.4-5.9h-6.8z"
        fill="none"
        stroke="#0038B8"
        strokeWidth={1}
      />
    </>
  ),
}

const VARIANT_CLASS = {
  chip: 'flag-chip',
  wash: 'flag-wash',
  'wash-row': 'flag-wash-row',
  'wash-hero': 'flag-wash-hero',
} as const

export function NationFlag({
  slug,
  variant = 'chip',
  className = '',
}: {
  slug: string
  /** chip: inline beside the nation name; wash / wash-row: faint watermarks
      at pane and ledger-row scale. */
  variant?: keyof typeof VARIANT_CLASS
  className?: string
}) {
  const shapes = FLAGS[slug]
  if (!shapes) return null
  return (
    <span
      aria-hidden="true"
      className={`${VARIANT_CLASS[variant]} ${className}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full">
        {shapes}
      </svg>
    </span>
  )
}
