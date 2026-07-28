import { RecordHistory } from '#/components/record-history'
import { RecordName } from '#/components/record-name'
import { SectionHead } from '#/components/section-head'
import { formatDayYear, formatHeldDays, stoodSecs } from '#/lib/dates'
import { titleReigns } from '#/lib/rules'
import type { HistoryStep } from '#/components/record-history'
import type { RecordNameProps } from '#/components/record-name'

export interface TitleHistoryRow extends RecordNameProps {
  kills: number
  verifiedAt: Date | string | null
  patch: string
  isCurrent: boolean
}

/* Every verified life this title has had, newest first. Tenure comes from the
   title frontier, not from row order: the corpus carries verified lives that
   never beat the standing record, and one of those must never look like it
   held the title or like it ended somebody else's reign. */
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
  const newestFirst = titleReigns(
    rows.map((row) => ({
      ...row,
      verifiedAt: row.verifiedAt == null ? null : new Date(row.verifiedAt),
    })),
  ).reverse()

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
          {newestFirst.map(({ row, heldTitle, endedAt }, i) => {
            const stood = stoodSecs(row.verifiedAt, endedAt)
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
                  ) : !heldTitle ? (
                    'did not take the title'
                  ) : stood != null ? (
                    `stood ${formatHeldDays(stood)}`
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
