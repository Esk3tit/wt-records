import { RemovedTag } from '#/components/removed-tag'
import type { PodiumRecord } from '#/components/podium'

const MEDAL = [
  { pane: 'medal-gold', text: 'text-gold', label: 'Gold' },
  { pane: 'medal-silver', text: 'text-silver', label: 'Silver' },
  { pane: 'medal-bronze', text: 'text-bronze', label: 'Bronze' },
]

function WeekCard({ record, rank }: { record: PodiumRecord; rank: number }) {
  const medal = rank < MEDAL.length ? MEDAL[rank] : null
  return (
    <article
      className={`glass-mid relative mr-3.5 w-[13.5rem] shrink-0 p-5${medal ? ` ${medal.pane}` : ''}`}
    >
      <p className="flex items-baseline justify-between text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">
        <span className={medal ? medal.text : 'text-fg-faint'}>
          #{rank + 1}
        </span>
        {medal && <span className={medal.text}>{medal.label}</span>}
      </p>
      <p className="mt-3 text-4xl leading-none font-bold tracking-[-0.03em] text-fg">
        {record.kills}
        <span className="ml-1 text-xs font-medium tracking-[0.06em] text-fg-muted">
          kills
        </span>
      </p>
      <p className="mt-3 truncate text-[0.9375rem] font-semibold text-fg">
        {record.vehicleName}
        {record.isRemoved && <RemovedTag />}
      </p>
      <p className="mt-0.5 truncate text-[0.8125rem] text-fg-muted">
        {record.displayName} · {record.nationName}
      </p>
    </article>
  )
}

/* Non-interactive drift, duplicated track for a seamless loop. With too few
   cards the loop reads as a glitch, so short weeks render a static row. */
export function WeekMarquee({ records }: { records: PodiumRecord[] }) {
  const drift = records.length >= 4
  return (
    <div className="week-marquee -mx-5 px-5 pt-1 pb-2">
      <div className="week-track" data-drift={drift ? '' : undefined}>
        {records.map((r, i) => (
          <WeekCard key={r.id} record={r} rank={i} />
        ))}
        {drift && (
          <div aria-hidden="true" className="flex">
            {records.map((r, i) => (
              <WeekCard key={r.id} record={r} rank={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
