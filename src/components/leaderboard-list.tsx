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
  if (rows.length === 0)
    return <p className="px-5 py-4 text-fg-muted">No records yet.</p>
  const max = rows[0].records
  return (
    <ol>
      {rows.map((row, i) => (
        <li
          key={row.slug}
          className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3.5 border-b border-hairline-soft px-5 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
        >
          <span
            className={
              'text-center font-bold ' +
              (medals ? (RANK_COLOR[i] ?? 'text-fg-faint') : 'text-fg-faint')
            }
          >
            {i + 1}
          </span>
          <span className="min-w-0">
            <Link
              to="/player/$slug"
              params={{ slug: row.slug }}
              className="font-semibold no-underline hover:underline"
            >
              {row.displayName}
            </Link>
            <span className="mt-0.5 block text-[0.6875rem] font-medium text-fg-muted">
              {row.records} {row.records === 1 ? 'record' : 'records'} held
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="hidden h-1.5 w-[5.625rem] overflow-hidden rounded-full bg-tint-strong sm:block"
            >
              <span
                className="block h-full rounded-full bg-[var(--ink-faint)]"
                style={{ width: `${(row.records / max) * 100}%` }}
              />
            </span>
            <span className="min-w-[1.875rem] text-right text-[1.0625rem] font-bold text-fg">
              {row.records}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
