import { NationFlag } from '#/components/nation-flag'
import { RecordName } from '#/components/record-name'
import { VehicleIcon } from '#/components/vehicle-icon'
import { VehicleLink } from '#/components/vehicle-link'
import { daysSince, formatDayYear } from '#/lib/dates'
import type { TopRecordRow } from '#/components/top-records'

export interface PodiumRecord extends TopRecordRow {
  id: number
  verifiedAt: Date | null
}

type Metal = 'gold' | 'silver' | 'bronze'
const METAL_TEXT: Record<Metal, string> = {
  gold: 'text-gold',
  silver: 'text-silver',
  bronze: 'text-bronze',
}
const METAL_PANE: Record<Metal, string> = {
  gold: 'pane-gold',
  silver: 'pane-silver',
  bronze: 'pane-bronze',
}

function heldLine(verifiedAt: Date): string {
  const days = daysSince(verifiedAt)
  if (days === 0) return `Set today · ${formatDayYear(verifiedAt)}`
  return `Held ${days} ${days === 1 ? 'day' : 'days'} · since ${formatDayYear(verifiedAt)}`
}

function PodiumCard({
  mode,
  rank,
  metal,
  record,
  big = false,
}: {
  mode: string
  rank: number
  metal: Metal
  record: PodiumRecord
  big?: boolean
}) {
  return (
    <article
      className={`glass-mid pane-lift ${METAL_PANE[metal]} overflow-hidden ${big ? 'p-7' : 'p-5'}`}
    >
      <NationFlag slug={record.nationSlug} variant="wash" />
      <div className="relative z-[1]">
        <p
          className={`flex items-baseline justify-between text-[0.6875rem] font-semibold tracking-[0.12em] uppercase ${METAL_TEXT[metal]}`}
        >
          <span>#{rank}</span>
          <span>{metal}</span>
        </p>
        <div
          className={
            big
              ? 'mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-3'
              : 'mt-2 flex items-center justify-between gap-4'
          }
        >
          {big ? (
            <p className="mt-2 text-6xl leading-none font-bold tracking-[-0.03em] text-fg">
              {record.kills}
              <span className="ml-1.5 text-xs font-medium tracking-[0.06em] text-fg-muted">
                kills
              </span>
            </p>
          ) : (
            <div className="min-w-0">
              <p className="text-5xl leading-none font-bold tracking-[-0.03em] text-fg">
                {record.kills}
                <span className="ml-1.5 text-xs font-medium tracking-[0.06em] text-fg-muted">
                  kills
                </span>
              </p>
              <p className="mt-3 text-[1.0625rem] font-semibold text-fg">
                <VehicleLink
                  mode={mode}
                  slug={record.vehicleSlug}
                  name={record.vehicleName}
                  tags={record}
                />
              </p>
              <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
                <RecordName
                  displayName={record.displayName}
                  playerSlug={record.playerSlug}
                  ignSnapshot={record.ignSnapshot}
                  displayNameSnapshot={record.displayNameSnapshot}
                />
                {' · '}
                <NationFlag slug={record.nationSlug} className="mr-0.5" />
                {record.nationName}
              </p>
            </div>
          )}
          {record.vehicleImage && (
            <img
              src={record.vehicleImage}
              alt=""
              className={`vehicle-portrait ${big ? 'h-24 md:h-28' : 'h-20 shrink-0 self-end sm:h-24'}`}
              loading="lazy"
              draggable={false}
            />
          )}
          {big && (
            <div className="text-right">
              <p className="mt-3 text-[1.0625rem] font-semibold text-fg">
                <VehicleLink
                  mode={mode}
                  slug={record.vehicleSlug}
                  name={record.vehicleName}
                  tags={record}
                />
              </p>
              <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
                <RecordName
                  displayName={record.displayName}
                  playerSlug={record.playerSlug}
                  ignSnapshot={record.ignSnapshot}
                  displayNameSnapshot={record.displayNameSnapshot}
                />
                {' · '}
                <NationFlag slug={record.nationSlug} className="mr-0.5" />
                {record.nationName}
              </p>
              {record.verifiedAt && (
                <p className="mt-1 text-xs text-fg-faint">
                  {heldLine(record.verifiedAt)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function LedgerRows({
  mode,
  rows,
  startRank,
}: {
  mode: string
  rows: PodiumRecord[]
  startRank: number
}) {
  return (
    <div className="glass-mid overflow-hidden">
      <ol>
        {rows.map((r, i) => (
          <li
            key={r.id}
            className="relative overflow-hidden border-b border-hairline-soft transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
          >
            <NationFlag slug={r.nationSlug} variant="wash-row" />
            <div className="relative z-[1] grid grid-cols-[2.5rem_1fr_auto] items-center gap-3.5 px-5 py-3">
              <span className="text-center font-bold text-fg-faint">
                {startRank + i}
              </span>
              {/* One ledger line on sm+; narrow screens stack holder under the
                  name so chips and holder stay whole instead of clipping. */}
              <span className="min-w-0 sm:truncate">
                <span className="block font-semibold break-words text-fg sm:inline">
                  <VehicleIcon src={r.vehicleImage} className="mr-1" />
                  <VehicleLink
                    mode={mode}
                    slug={r.vehicleSlug}
                    name={r.vehicleName}
                    tags={r}
                  />
                </span>
                <span className="block truncate text-xs text-fg-muted sm:ml-2 sm:inline">
                  <RecordName
                    displayName={r.displayName}
                    playerSlug={r.playerSlug}
                    ignSnapshot={r.ignSnapshot}
                    displayNameSnapshot={r.displayNameSnapshot}
                  />
                  {' · '}
                  <NationFlag slug={r.nationSlug} className="mr-0.5" />
                  {r.nationName}
                </span>
              </span>
              <span className="text-right text-[1.0625rem] font-bold text-fg">
                {r.kills}
                <span className="ml-1 text-[0.6875rem] font-medium tracking-[0.06em] text-fg-muted">
                  kills
                </span>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* Ranks 1–5: gold panel on top, silver + bronze pair, ledger tail. */
export function Podium({
  mode,
  records,
}: {
  mode: string
  records: PodiumRecord[]
}) {
  // Indexed access is typed always-present here; make emptiness explicit.
  const first = records.length > 0 ? records[0] : null
  const second = records.length > 1 ? records[1] : null
  const third = records.length > 2 ? records[2] : null
  const rest = records.slice(3)
  return (
    <div className="flex flex-col gap-3.5">
      {first && (
        <PodiumCard mode={mode} rank={1} metal="gold" record={first} big />
      )}
      {(second || third) && (
        <div className="podium-pair">
          {second && (
            <PodiumCard mode={mode} rank={2} metal="silver" record={second} />
          )}
          {third && (
            <PodiumCard mode={mode} rank={3} metal="bronze" record={third} />
          )}
        </div>
      )}
      {rest.length > 0 && <LedgerRows mode={mode} rows={rest} startRank={4} />}
    </div>
  )
}
