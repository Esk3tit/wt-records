import { Link } from '@tanstack/react-router'

const RANK_COLOR = ['text-gold', 'text-silver', 'text-bronze']

export interface LeaderboardRow {
  slug: string
  displayName: string
  records: number
}

export function LeaderboardList({
  rows,
  medals = false,
}: {
  rows: LeaderboardRow[]
  medals?: boolean
}) {
  if (rows.length === 0) return <p className="text-fg-muted">No records yet.</p>
  return (
    <ol className="space-y-1">
      {rows.map((row, i) => (
        <li key={row.slug} className="flex items-baseline gap-3">
          <span
            className={
              'w-6 text-right ' +
              (medals ? (RANK_COLOR[i] ?? 'text-fg-faint') : 'text-fg-faint')
            }
          >
            {i + 1}
          </span>
          <Link to="/player/$slug" params={{ slug: row.slug }}>
            {row.displayName}
          </Link>
          <span className="ml-auto text-fg-muted">{row.records}</span>
        </li>
      ))}
    </ol>
  )
}
