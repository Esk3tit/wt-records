import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'
import { VehicleIcon } from '#/components/vehicle-icon'
import { VehicleTags, hasVehicleTags } from '#/components/vehicle-tags'
import type { PodiumRecord } from '#/components/podium'

const MEDAL = [
  { pane: 'medal-gold', text: 'text-gold', label: 'Gold' },
  { pane: 'medal-silver', text: 'text-silver', label: 'Silver' },
  { pane: 'medal-bronze', text: 'text-bronze', label: 'Bronze' },
]

function WeekCard({
  mode,
  record,
  rank,
}: {
  mode: string
  record: PodiumRecord
  rank: number
}) {
  const medal = rank < MEDAL.length ? MEDAL[rank] : null
  return (
    <article
      className={`glass-mid relative w-[13.5rem] shrink-0 snap-start overflow-hidden p-5${medal ? ` ${medal.pane}` : ''}`}
    >
      <NationFlag
        slug={record.nationSlug}
        variant="wash"
        className="flag-wash--soft"
      />
      <div className="relative z-[1]">
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
          <VehicleIcon src={record.vehicleImage} className="mr-1" />
          <Link
            to="/$mode/vehicle/$slug"
            params={{ mode, slug: record.vehicleSlug }}
            className="no-underline hover:underline"
          >
            {record.vehicleName}
          </Link>
        </p>
        {/* Chips on their own wrapping row: the fixed card is the one surface
            where the truncating name line would clip them. */}
        {hasVehicleTags(record) && (
          <p className="-ml-1.5 flex flex-wrap">
            <VehicleTags tags={record} />
          </p>
        )}
        <p className="mt-0.5 truncate text-[0.8125rem] text-fg-muted">
          {record.displayName} ·{' '}
          <NationFlag slug={record.nationSlug} className="mr-0.5" />
          {record.nationName}
        </p>
      </div>
    </article>
  )
}

/* ≥4 cards: an ambient drift that pauses on hover/focus so the links stay
   clickable. Fewer cards (and always on touch-scroll): a plain snap scroller —
   a partially visible card is the scroll affordance. */
export function WeekMarquee({
  mode,
  records,
}: {
  mode: string
  records: PodiumRecord[]
}) {
  const drift = records.length >= 4
  if (!drift) {
    return (
      <div className="-mx-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pt-1 pb-2">
        {records.map((r, i) => (
          <WeekCard key={r.id} mode={mode} record={r} rank={i} />
        ))}
      </div>
    )
  }
  return (
    <div className="week-marquee -mx-5 px-5 pt-1 pb-2">
      <div className="week-track gap-3.5" data-drift="">
        {records.map((r, i) => (
          <WeekCard key={r.id} mode={mode} record={r} rank={i} />
        ))}
        <div aria-hidden="true" inert className="flex gap-3.5">
          {records.map((r, i) => (
            <WeekCard key={r.id} mode={mode} record={r} rank={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
