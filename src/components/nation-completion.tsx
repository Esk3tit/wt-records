import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'

export interface NationRow {
  slug: string
  name: string
  eligibleVehicles: number
  coveredVehicles: number
  completionPct: number
}

export function NationCompletion({
  mode,
  nations,
}: {
  mode: string
  nations: NationRow[]
}) {
  return (
    <div className="glass-mid px-5 py-2">
      <ul className="nation-list">
        {nations.map((n) => (
          <li
            key={n.slug}
            className="border-b border-hairline-soft py-3 last:border-b-0"
          >
            <Link
              to="/$mode/nation/$slug"
              params={{ mode, slug: n.slug }}
              className="grid grid-cols-[7rem_minmax(0,1fr)_auto_auto] items-center gap-3.5 no-underline transition-colors duration-200 hover:bg-[var(--row-hover)]"
            >
              <span className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-semibold text-fg">
                <NationFlag slug={n.slug} />
                <span className="truncate">{n.name}</span>
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 overflow-hidden rounded-full bg-tint-strong"
              >
                <span
                  className="block h-full rounded-full bg-[var(--ink-faint)]"
                  style={{ width: `${n.completionPct}%` }}
                />
              </span>
              <span className="text-xs tabular-nums text-fg-muted">
                {n.coveredVehicles} / {n.eligibleVehicles}
              </span>
              <span className="min-w-[2.75rem] text-right text-[0.9375rem] font-bold tabular-nums text-fg">
                {n.completionPct}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
