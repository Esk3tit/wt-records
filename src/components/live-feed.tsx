import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { LatestRecord } from '#/components/latest-record'
import { formatFeedDay, isToday } from '#/lib/dates'
import { mergeFeedRows } from '#/components/live-feed-rows'
import { LiveSignalsContext } from '#/realtime/live-signals-context'
import type { CSSProperties } from 'react'
import type { FeedRow, FeedRowPhase } from '#/components/live-feed-rows'
import type { LatestRecordData } from '#/components/latest-record'

export interface FeedEntry extends LatestRecordData {
  id: number
  verifiedAt: Date | null
}

// Slightly past the CSS exit animation so the fade always completes first.
const EXIT_REMOVE_MS = 500

// The lg rail can't fit more; an overflow-clipped row would still be read by
// assistive tech, so never render one.
const MAX_ROWS = 7

const phaseClass: Record<FeedRowPhase, string> = {
  settled: '',
  entering: 'feed-item-new',
  exiting: 'feed-item-exit',
}

// Age position 0 (oldest) → 1 (newest); CSS maps it to an opacity per
// breakpoint so the mask fade never stacks the top rows into illegibility.
function ageT(index: number, count: number): number {
  if (count <= 1) return 1
  return index / (count - 1)
}

/* Kill-feed register: a static log that moves only when a record lands —
   the newcomer slots in at the bottom, the displaced oldest fades out. */
export function LiveFeed({
  mode,
  entries,
}: {
  mode: string
  entries: FeedEntry[]
}) {
  const live = useContext(LiveSignalsContext)
  const oldestFirst = useMemo(
    () => entries.slice(0, MAX_ROWS).reverse(),
    [entries],
  )
  const [rows, setRows] = useState<FeedRow<FeedEntry>[]>(() =>
    oldestFirst.map((entry) => ({ entry, phase: 'settled' })),
  )

  useEffect(() => {
    setRows((prev) => mergeFeedRows(prev, oldestFirst))
  }, [oldestFirst])

  // Each exiting row is stamped with its own removal deadline: a later exit
  // wave gets its full fade, yet a busy event stream can't postpone the sweep.
  const exitDeadlines = useRef(new Map<number, number>())

  useEffect(() => {
    const deadlines = exitDeadlines.current
    const exitingIds = new Set(
      rows.filter((row) => row.phase === 'exiting').map((row) => row.entry.id),
    )
    for (const id of deadlines.keys()) {
      if (!exitingIds.has(id)) deadlines.delete(id)
    }
    const now = Date.now()
    for (const id of exitingIds) {
      if (!deadlines.has(id)) deadlines.set(id, now + EXIT_REMOVE_MS)
    }
    if (deadlines.size === 0) return
    const timer = setTimeout(
      () => {
        const cutoff = Date.now()
        setRows((prev) =>
          prev.filter(
            (row) =>
              row.phase !== 'exiting' ||
              (exitDeadlines.current.get(row.entry.id) ?? 0) > cutoff,
          ),
        )
      },
      Math.max(0, Math.min(...deadlines.values()) - now),
    )
    return () => clearTimeout(timer)
  }, [rows])

  return (
    <aside
      className="glass-mid flex h-full flex-col overflow-hidden"
      aria-label="Latest verified records"
    >
      <header className="flex items-center gap-2 border-b border-hairline-soft px-5 py-3.5">
        {live && (
          <span
            aria-hidden="true"
            className="feed-dot h-1.5 w-1.5 rounded-full"
          />
        )}
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-fg-muted">
          Latest · verified
          {live && (
            <span className="sr-only"> — live, updates automatically</span>
          )}
        </h2>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-fg-muted">
          No verified records yet.
        </p>
      ) : (
        <ol
          aria-live="polite"
          className="feed-scroll flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-5 pb-4"
        >
          {rows.map((row, i) => (
            <li
              key={row.entry.id}
              className={[
                'feed-row border-b border-hairline-soft py-3 text-[0.8125rem] leading-[1.45] text-fg last:border-b-0',
                phaseClass[row.phase],
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ '--feed-age-t': ageT(i, rows.length) } as CSSProperties}
            >
              <div className="flex min-h-0 gap-2 overflow-hidden">
                <span
                  className={[
                    'w-12 shrink-0 font-medium tabular-nums',
                    // The newest entries keep a recency glow until the date
                    // ages out — a glance can tell something landed today.
                    row.entry.verifiedAt && isToday(row.entry.verifiedAt)
                      ? 'font-semibold text-accent-text'
                      : 'text-fg-faint',
                  ].join(' ')}
                >
                  {row.entry.verifiedAt
                    ? formatFeedDay(row.entry.verifiedAt)
                    : '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <LatestRecord mode={mode} record={row.entry} />
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
