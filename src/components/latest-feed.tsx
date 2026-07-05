import { useEffect, useRef, useState } from 'react'
import { LatestRecord } from '#/components/latest-record'
import { formatFeedDay } from '#/lib/dates'
import type { LatestRecordData } from '#/components/latest-record'

export interface FeedEntry extends LatestRecordData {
  id: number
  verifiedAt: Date | null
}

interface FeedItem {
  uid: number
  entry: FeedEntry
}

const CYCLE_MS = 4000

/* Chat-log register: newest entry rises in at the bottom, oldest dissolves
   under the top fade. `cycle` demos that motion by rotating through the
   entries client-side — the Realtime feed replaces the rotation with real
   events. SSR and reduced motion render the static list. */
export function LatestFeed({
  mode,
  entries,
  cycle = false,
}: {
  mode: string
  entries: FeedEntry[]
  cycle?: boolean
}) {
  const oldestFirst = entries.slice().reverse()
  const [items, setItems] = useState<FeedItem[]>(() =>
    oldestFirst.map((entry, i) => ({ uid: i, entry })),
  )
  const [cycling, setCycling] = useState(false)
  const uidRef = useRef(oldestFirst.length)
  const poolRef = useRef(0)

  useEffect(() => {
    if (!cycle || entries.length < 3) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setCycling(true)
    const pool = entries.slice().reverse()
    const timer = setInterval(() => {
      setItems((prev) => {
        const entry = pool[poolRef.current % pool.length]
        poolRef.current += 1
        return [...prev, { uid: uidRef.current++, entry }].slice(-8)
      })
    }, CYCLE_MS)
    return () => clearInterval(timer)
  }, [cycle, entries])

  return (
    <aside
      className="glass-mid flex h-full flex-col overflow-hidden"
      aria-label="Latest verified records"
    >
      <header className="flex items-center gap-2 border-b border-hairline-soft px-5 py-3.5">
        {cycling && (
          <span
            aria-hidden="true"
            className="feed-dot h-1.5 w-1.5 rounded-full bg-accent"
          />
        )}
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-fg-muted">
          Latest · verified
        </h2>
      </header>
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-fg-muted">
          No verified records yet.
        </p>
      ) : (
        <ol className="feed-scroll flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-5 pb-4">
          {items.map((item, i) => (
            <li
              key={item.uid}
              className={`border-b border-hairline-soft py-3 text-[0.8125rem] leading-[1.45] text-fg last:border-b-0${
                cycling && i === items.length - 1 ? ' feed-item-new' : ''
              }`}
            >
              <span className="mr-2 font-medium tabular-nums text-fg-faint">
                {item.entry.verifiedAt
                  ? formatFeedDay(item.entry.verifiedAt)
                  : '—'}
              </span>
              <LatestRecord mode={mode} record={item.entry} />
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
