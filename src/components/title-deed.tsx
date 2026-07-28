import { Link } from '@tanstack/react-router'
import { AcquisitionWash } from '#/components/acquisition-wash'
import { NationFlag } from '#/components/nation-flag'
import { PlayerAvatar } from '#/components/player-avatar'
import { RecordName } from '#/components/record-name'
import { VehicleTags } from '#/components/vehicle-tags'
import { daysSince, formatDayYear } from '#/lib/dates'
import { formatBr } from '#/lib/format'
import { titleBar } from '#/lib/rules'
import type { RecordNameProps } from '#/components/record-name'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface TitleDeedVehicle extends VehicleTagFlags {
  name: string
  class: string
  rank: number | null
  isDifficult: boolean
  nationSlug: string
  nationName: string
  image: string | null
}

export interface TitleDeedRecord extends RecordNameProps {
  kills: number
  runBr: number | null
  patch: string
  patchName: string | null
  verifiedAt: Date | string | null
  holderAvatar: string | null
}

const KICKER =
  'text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase'
const MONUMENT =
  'mt-1 text-[clamp(3.75rem,8vw,5.5rem)] leading-none font-bold tracking-[-0.03em]'

function heldLine(verifiedAt: Date | string): string {
  const days = daysSince(verifiedAt)
  if (days === 0) return `Set today · ${formatDayYear(verifiedAt)}`
  return `Held ${days} ${days === 1 ? 'day' : 'days'} · since ${formatDayYear(verifiedAt)}`
}

/* One title stated as a document: the machine set into the pane's corner, and
   the page closing on the number a challenger has to put on the board. */
export function TitleDeed({
  mode,
  vehicle,
  br,
  current,
  standing,
  minKills,
}: {
  mode: string
  vehicle: TitleDeedVehicle
  br: number | null
  current: TitleDeedRecord | null
  /** The kills a challenger must exceed — see standingKills, which is not
      always the holder's own score. */
  standing: number | null
  /** The mode's qualifying bar for this vehicle's class (difficult override
      already applied), or null when the mode configures none. */
  minKills: number | null
}) {
  const bar = titleBar(standing, minKills, current != null)
  // makeCurrentRecord can install a record the frontier does not end on, and
  // demoteRecord can leave one standing with no holder. Either way the row's
  // own verifiedAt stops meaning "since when this has held".
  const displaced = standing != null && standing > (current?.kills ?? -Infinity)
  // It only explains the bar when it IS the bar — a higher qualifying minimum
  // overrules it, and quoting the lower score would contradict the numeral.
  const standingSetsBar = displaced && bar.kills === standing + 1
  return (
    <header className="glass-thick relative overflow-hidden p-7 [--deed-art-h:8rem] sm:[--deed-art-h:11rem] md:p-10 lg:[--deed-art-h:clamp(14rem,26vw,21rem)]">
      <div aria-hidden="true" className="absolute inset-0 z-0">
        <AcquisitionWash tags={vehicle} scale="pane" />
        <NationFlag slug={vehicle.nationSlug} variant="wash-sheet" />
      </div>

      <div className="relative z-[1] flex flex-col gap-y-2 lg:flex-row lg:items-end lg:gap-x-10">
        <div className="min-w-0 lg:flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-fg-muted">
            <Link
              to="/$mode/nation/$slug"
              params={{ mode, slug: vehicle.nationSlug }}
              className="inline-flex items-center gap-1.5 text-fg-muted no-underline transition-colors duration-200 hover:text-fg hover:underline"
            >
              <NationFlag slug={vehicle.nationSlug} />
              {vehicle.nationName}
            </Link>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{vehicle.class}</span>
            {vehicle.rank != null && (
              <>
                <span aria-hidden="true">·</span>
                <span>rank {vehicle.rank}</span>
              </>
            )}
            {br != null && (
              <>
                <span aria-hidden="true">·</span>
                <span>BR {formatBr(br)}</span>
              </>
            )}
          </p>

          <h1 className="mt-1.5 text-3xl font-bold tracking-[-0.02em] text-balance md:text-4xl">
            {vehicle.name}
            <VehicleTags tags={vehicle} />
          </h1>

          {current ? (
            <div className="mt-8">
              <p className={KICKER}>World record</p>
              <p className={MONUMENT}>
                {current.kills}
                <span className="ml-2 stat-unit text-[0.9375rem]">kills</span>
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                <PlayerAvatar
                  avatarUrl={current.holderAvatar}
                  displayName={current.displayName}
                  size={32}
                  eager
                />
                <div className="min-w-0">
                  <p className="text-[1.0625rem] leading-snug font-semibold">
                    <RecordName {...current} />
                  </p>
                  <p className="text-[0.8125rem] text-fg-muted">
                    {!current.verifiedAt
                      ? 'Migrated from the community record book'
                      : displaced
                        ? `Verified ${formatDayYear(current.verifiedAt)}`
                        : heldLine(current.verifiedAt)}
                  </p>
                </div>
              </div>
              {/* Muted, not faint: faint misses the AA floor on thick glass. */}
              <p className="mt-2 text-[0.8125rem] text-fg-muted">
                Patch {current.patch}
                {current.patchName ? ` · ${current.patchName}` : ''}
                {current.runBr != null
                  ? ` · run BR ${formatBr(current.runBr)}`
                  : ''}
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <p className={KICKER}>Open bounty</p>
              {bar.kills != null ? (
                <p className={`${MONUMENT} text-accent-text`}>
                  {bar.kills}
                  <span className="ml-2 stat-unit text-[0.9375rem]">kills</span>
                </p>
              ) : (
                <p className="mt-2 max-w-[34ch] text-[0.9375rem] text-fg-muted">
                  No verified holder yet — this title is waiting for its first
                  claim.
                </p>
              )}
            </div>
          )}

          {bar.kills != null && (
            <p className="mt-6 max-w-[58ch] border-t border-hairline-soft pt-4 text-[0.9375rem] text-fg-muted">
              {bar.held ? (
                // The bar, never "beat N+1": told to beat 24 you would have to
                // score 25, which is one more than the title actually costs.
                <>
                  Take this title with{' '}
                  <strong className="font-semibold text-fg">
                    {bar.kills} kills
                  </strong>{' '}
                  in one life — matching the record does not supersede it.
                </>
              ) : // The numeral above already IS this number; the line says what
              // it is, rather than saying it twice.
              standingSetsBar ? (
                <>
                  No one holds this title, but a verified{' '}
                  <strong className="font-semibold text-fg">
                    {standing} kills
                  </strong>{' '}
                  still stands against it — that is the score to exceed.
                </>
              ) : (
                <>
                  The{' '}
                  {vehicle.isDifficult ? 'Difficult' : `${vehicle.class}-class`}{' '}
                  qualifying bar for {mode.toUpperCase()} — first to clear it in
                  one life takes the title.
                </>
              )}
            </p>
          )}
        </div>

        {vehicle.image && (
          <div className="-mr-7 -mb-7 mt-3 h-[var(--deed-art-h)] shrink-0 md:-mr-10 md:-mb-10 lg:mt-0 lg:w-[46%]">
            <img
              src={vehicle.image}
              alt=""
              className="title-deed-art"
              loading="eager"
              draggable={false}
            />
          </div>
        )}
      </div>
    </header>
  )
}
