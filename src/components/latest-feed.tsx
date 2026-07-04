import { LatestRecord } from '#/components/latest-record'
import { formatFeedDay } from '#/lib/dates'
import type { LatestRecordData } from '#/components/latest-record'

export interface FeedEntry extends LatestRecordData {
  id: number
  verifiedAt: Date | null
}

/* Chat-log register: newest entry at the bottom, oldest dissolving under the
   top fade. Static for now — the Realtime feed will stream into this slot. */
export function LatestFeed({
  mode,
  entries,
}: {
  mode: string
  entries: FeedEntry[]
}) {
  const oldestFirst = entries.slice().reverse()
  return (
    <aside
      className="glass-mid flex h-full flex-col overflow-hidden"
      aria-label="Latest verified records"
    >
      <header className="border-b border-hairline-soft px-5 py-3.5">
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-fg-muted">
          Latest · verified
        </h2>
      </header>
      {oldestFirst.length === 0 ? (
        <p className="px-5 py-4 text-sm text-fg-muted">
          No verified records yet.
        </p>
      ) : (
        <ol className="feed-scroll flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-5 pb-4">
          {oldestFirst.map((entry) => (
            <li
              key={entry.id}
              className="border-b border-hairline-soft py-3 text-[0.8125rem] leading-[1.45] text-fg last:border-b-0"
            >
              <span className="mr-2 font-medium tabular-nums text-fg-faint">
                {entry.verifiedAt ? formatFeedDay(entry.verifiedAt) : '—'}
              </span>
              <LatestRecord mode={mode} record={entry} />
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
