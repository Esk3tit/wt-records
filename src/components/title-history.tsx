import { RecordHistory } from '#/components/record-history'
import { RecordName } from '#/components/record-name'
import { SectionHead } from '#/components/section-head'
import { formatDayYear, stoodDays } from '#/lib/dates'
import type { HistoryStep } from '#/components/record-history'
import type { RecordNameProps } from '#/components/record-name'

export interface TitleHistoryRow extends RecordNameProps {
  kills: number
  verifiedAt: Date | string | null
  patch: string
  isCurrent: boolean
}

/* Every verified life this title has had, newest first. A tenure is knowable
   only from the entry that ended it, hence the successor lookup below. */
export function TitleHistory({
  rows,
  steps,
}: {
  /** Oldest first, as the loader returns them. */
  rows: Array<TitleHistoryRow>
  steps: Array<HistoryStep>
}) {
  if (rows.length < 2) return null
  const charted = steps.length >= 2
  // Newest first for reading; each entry's successor is its predecessor here.
  const newestFirst = [...rows].reverse()

  return (
    <section className="mt-8">
      <SectionHead
        title="Record history"
        aside={`${rows.length} verified lives`}
      />
      <div
        className={`grid items-stretch gap-3.5 ${charted ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}
      >
        {charted && <RecordHistory steps={steps} />}
        <ol className="glass-mid overflow-hidden">
          {newestFirst.map((row, i) => {
            const stood = row.isCurrent
              ? null
              : stoodDays(
                  row.verifiedAt,
                  newestFirst[i - 1]?.verifiedAt ?? null,
                )
            return (
              <li
                key={`${row.playerSlug}-${row.kills}-${i}`}
                className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 border-b border-hairline-soft px-5 py-3 last:border-b-0"
              >
                <span
                  className={`text-right text-[1.0625rem] font-bold tabular-nums ${row.isCurrent ? 'text-fg' : 'text-fg-muted'}`}
                >
                  {row.kills}
                </span>
                <span className="min-w-0 truncate text-[0.9375rem]">
                  <span
                    className={
                      row.isCurrent ? 'font-semibold text-fg' : 'text-fg-muted'
                    }
                  >
                    <RecordName {...row} />
                  </span>
                </span>
                <span className="text-xs whitespace-nowrap text-fg-faint">
                  {row.verifiedAt ? formatDayYear(row.verifiedAt) : 'migrated'}
                  {` · ${row.patch}`}
                </span>
                {/* Under the name, not beside it: the name cell truncates. */}
                <span className="col-start-2 -mt-0.5 text-[0.8125rem] text-fg-faint">
                  {row.isCurrent ? (
                    <span className="stat-label font-semibold text-fg-muted">
                      holds it
                    </span>
                  ) : stood != null ? (
                    `stood ${stood} ${stood === 1 ? 'day' : 'days'}`
                  ) : (
                    'superseded'
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
