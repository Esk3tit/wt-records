import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { NationFlag, hasNationFlag } from '#/components/nation-flag'
import {
  formatDayYear,
  formatDaysAgo,
  formatHeldDays,
  formatMonthYear,
} from '#/lib/dates'

// Dates arrive as strings once the loader payload crosses the wire.
type Stamp = Date | string

export interface ProfileEnrichmentData {
  nationSpread: { slug: string; name: string; records: number }[]
  longestHeld: {
    vehicleSlug: string
    vehicleName: string
    mode: string
    heldSeconds: number
    lostAt: Stamp | null
  } | null
  lastVerifiedAt: Stamp | null
}

interface Cell {
  key: string
  label: string
  value: ReactNode
  detail?: ReactNode
  /** The spread carries a variable number of flags — it earns extra width. */
  grow?: boolean
}

/* What kind of holder this Player is, beside their name. Each stat appears
   only when it has something true to say — never a row of dashes. */
export function ProfileEnrichment({ stats }: { stats: ProfileEnrichmentData }) {
  const { nationSpread, longestHeld, lastVerifiedAt } = stats
  const cells: Cell[] = []

  if (nationSpread.length > 0) {
    cells.push({
      key: 'spread',
      label: 'Titles by nation',
      grow: true,
      value: (
        <span className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          {nationSpread.map((n) => (
            <span
              key={n.slug}
              title={n.name}
              className="inline-flex items-center gap-1.5"
            >
              {hasNationFlag(n.slug) ? (
                <>
                  <NationFlag slug={n.slug} />
                  <span className="sr-only">{n.name}</span>
                </>
              ) : (
                <span className="text-sm font-medium text-fg-muted">
                  {n.name}
                </span>
              )}
              {n.records}
            </span>
          ))}
        </span>
      ),
    })
  }

  if (longestHeld) {
    cells.push({
      key: 'held',
      label: 'Longest held',
      value: formatHeldDays(longestHeld.heldSeconds),
      detail: (
        <>
          <Link
            to="/$mode/vehicle/$slug"
            params={{ mode: longestHeld.mode, slug: longestHeld.vehicleSlug }}
            className="font-medium text-fg decoration-hairline underline-offset-2 hover:decoration-current"
          >
            {longestHeld.vehicleName}
          </Link>
          {` · ${longestHeld.mode.toUpperCase()}`}
          {/* A closed window is history: say so, or an ex-holder reads as current. */}
          {longestHeld.lostAt != null &&
            ` · ended ${formatMonthYear(longestHeld.lostAt)}`}
        </>
      ),
    })
  }

  if (lastVerifiedAt != null) {
    cells.push({
      key: 'recency',
      label: 'Last verified',
      value: formatDaysAgo(lastVerifiedAt),
      detail: formatDayYear(lastVerifiedAt),
    })
  }

  if (cells.length === 0) return null

  return (
    <dl className="mt-5 flex flex-col gap-5 border-t border-hairline-soft pt-5 sm:flex-row sm:gap-0">
      {cells.map((cell) => (
        <div
          key={cell.key}
          className={`min-w-0 sm:border-l sm:border-hairline-soft sm:pr-6 sm:pl-6 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0 ${
            cell.grow ? 'sm:flex-[1.5]' : 'sm:flex-1'
          }`}
        >
          <dt className="stat-label text-fg-muted">{cell.label}</dt>
          <dd className="mt-2">
            <span className="block text-lg leading-none font-semibold text-fg">
              {cell.value}
            </span>
            {cell.detail != null && (
              <span className="mt-1.5 block text-[0.8125rem] leading-snug text-fg-muted">
                {cell.detail}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
