import { Link } from '@tanstack/react-router'
import { daysSince, formatMonthYear } from '#/lib/dates'

export interface HistoryStep {
  kills: number
  verifiedAt: Date | null
  displayName: string
  playerSlug: string
}

function HistoryChart({ steps }: { steps: HistoryStep[] }) {
  const W = 560
  const H = 190
  const padL = 16
  const padR = 44
  const padT = 26
  const padB = 34
  const kills = steps.map((s) => s.kills)
  const minK = Math.min(...kills) - 4
  const maxK = Math.max(...kills)
  const x = (i: number) => padL + (i / (steps.length - 1)) * (W - padL - padR)
  const y = (k: number) =>
    padT + (1 - (k - minK) / (maxK - minK)) * (H - padT - padB)

  let d = `M ${x(0)} ${y(steps[0].kills)}`
  steps.forEach((s, i) => {
    if (i === 0) return
    d += ` H ${x(i)} V ${y(s.kills)}`
  })
  d += ` H ${W - padR + 20}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      role="img"
      aria-label={`World record progression: ${steps[0].kills} to ${steps[steps.length - 1].kills} kills`}
    >
      <line
        x1={padL}
        y1={H - padB}
        x2={W - padR + 20}
        y2={H - padB}
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="1"
      />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(s.kills)}
              r={last ? 4 : 3}
              fill="currentColor"
              fillOpacity={last ? 1 : 0.55}
            />
            <text
              x={x(i)}
              y={y(s.kills) - 9}
              textAnchor="middle"
              fontSize="12"
              fontWeight={last ? 700 : 500}
              fill="currentColor"
              fillOpacity={last ? 1 : 0.6}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {s.kills}
            </text>
            <text
              x={x(i)}
              y={H - padB + 16}
              textAnchor={i === 0 ? 'start' : 'middle'}
              fontSize="10"
              fill="currentColor"
              fillOpacity="0.4"
            >
              {s.verifiedAt ? formatMonthYear(s.verifiedAt) : 'migrated'}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* The top vehicle's record climbing as a step chart: every step a verified
   life, holder churn in the caption. */
export function RecordHistory({ steps }: { steps: HistoryStep[] }) {
  // A single step has no progression to chart (and would divide by zero).
  if (steps.length < 2) return null
  const holders = new Set(steps.map((s) => s.playerSlug)).size
  const first = steps[0]
  const current = steps[steps.length - 1]
  return (
    <div className="glass-mid flex h-full flex-col p-6">
      <div className="text-fg">
        <HistoryChart steps={steps} />
      </div>
      <p className="mt-3 border-t border-hairline-soft pt-3 text-xs text-fg-muted">
        {holders} {holders === 1 ? 'holder' : 'holders'} since{' '}
        {first.verifiedAt ? formatMonthYear(first.verifiedAt) : 'migration'} ·
        every step a verified life · current:{' '}
        <Link
          to="/player/$slug"
          params={{ slug: current.playerSlug }}
          className="font-semibold text-fg no-underline hover:underline"
        >
          {current.displayName}
        </Link>
        {current.verifiedAt && `, ${daysSince(current.verifiedAt)} days`}
      </p>
    </div>
  )
}
