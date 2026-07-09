import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { LatestRecord } from '#/components/latest-record'
import { formatFeedDay } from '#/lib/dates'
import { mergeFeedRows } from '#/components/live-feed-rows'
import { LiveSignalsContext } from '#/realtime/live-signals-context'
import type { FeedRow, FeedRowPhase } from '#/components/live-feed-rows'
import type { LatestRecordData } from '#/components/latest-record'

export interface FeedEntry extends LatestRecordData {
  id: number
  verifiedAt: Date | null
}

// Slightly past the CSS exit animation so the fade always completes first.
const EXIT_REMOVE_MS = 500

// The at-rest age gradient: oldest row dimmest, newest full strength — the
// fade implies the log's flow direction even between events.
const REST_MIN_OPACITY = 0.55

const phaseClass: Record<FeedRowPhase, string> = {
  settled: '',
  entering: 'feed-item-new',
  exiting: 'feed-item-exit',
}

function restOpacity(index: number, count: number): number {
  if (count <= 1) return 1
  return REST_MIN_OPACITY + ((1 - REST_MIN_OPACITY) * index) / (count - 1)
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
  const oldestFirst = useMemo(() => entries.slice().reverse(), [entries])
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
            className="feed-dot h-1.5 w-1.5 rounded-full bg-accent"
          />
        )}
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-fg-muted">
          Latest · verified
        </h2>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-fg-muted">
          No verified records yet.
        </p>
      ) : (
        <ol className="feed-scroll flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-5 pb-4">
          {rows.map((row, i) => (
            <li
              key={row.entry.id}
              className={[
                'border-b border-hairline-soft py-3 text-[0.8125rem] leading-[1.45] text-fg last:border-b-0',
                phaseClass[row.phase],
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ opacity: restOpacity(i, rows.length) }}
            >
              <span className="mr-2 font-medium tabular-nums text-fg-faint">
                {row.entry.verifiedAt
                  ? formatFeedDay(row.entry.verifiedAt)
                  : '—'}
              </span>
              <LatestRecord mode={mode} record={row.entry} />
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
