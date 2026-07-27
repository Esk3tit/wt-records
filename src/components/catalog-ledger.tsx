import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'
import { PlayerAvatar } from '#/components/player-avatar'
import { RecordName } from '#/components/record-name'
import { VehicleIcon } from '#/components/vehicle-icon'
import { VehicleTags } from '#/components/vehicle-tags'
import { formatBr } from '#/lib/format'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface LedgerVehicleRow extends VehicleTagFlags {
  vehicleSlug: string
  vehicleName: string
  isDifficult: boolean
  nationSlug: string
  nationName: string
  br: number | null
  kills: number | null
  playerSlug: string | null
  displayName: string | null
  ignSnapshot: string | null
  displayNameSnapshot: string | null
}

/** A ledger row that carries its own imagery: the vehicle's silhouette and the
    Holder's face, both already resolved to serving URLs. */
export interface IllustratedRow extends LedgerVehicleRow {
  vehicleImage: string | null
  holderAvatar: string | null
}

/* Right padding stays per-column (pr-4 between, pr-5 at the pane edge). */
export const LEDGER_TH =
  'py-3 text-left text-xs font-semibold tracking-[0.05em] text-fg-muted uppercase'
export const LEDGER_ROW =
  'border-t border-hairline-soft transition-colors duration-200 hover:bg-[var(--row-hover)]'


/** The count-plus-reset line both catalog routes render above their filters. */
export function LedgerMeta({
  count,
  suffix,
  hasFilters,
  onReset,
}: {
  count: number
  suffix?: string
  hasFilters: boolean
  onReset: () => void
}) {
  return (
    <p className="text-[0.8125rem] text-fg-muted" aria-live="polite">
      {count} {count === 1 ? 'vehicle' : 'vehicles'}
      {suffix}
      {hasFilters && (
        <>
          {' · '}
          <button
            type="button"
            onClick={onReset}
            className="underline decoration-1 underline-offset-2 transition-colors duration-200 hover:text-fg"
          >
            Reset filters
          </button>
        </>
      )}
    </p>
  )
}

/** True once the pane has scrolled far enough that its head is pinned rather
    than parked. The head only takes its near-opaque backing while stuck — at
    rest it must stay glass, or it reads as a black bar laid across the pane. */
function useHeadStuck(enabled: boolean) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!enabled || !el) return
    const th = el.parentElement?.querySelector('thead th')
    if (!th) return
    // The park line is whatever --ledger-head-top resolves to right now; it
    // moves when the nav wraps, so it is read rather than assumed.
    const top = parseFloat(getComputedStyle(th).top) || 0
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])
  return { sentinel, stuck }
}

/* No horizontal scroller: it would make the pane a scrollport and silently pin
   the sticky head to the pane instead of the viewport. The row composes down
   instead — that is what keeps the ledger inside a phone. `@container` is what
   lets the row icon answer the pane's width rather than the viewport's. */
export function LedgerPane({
  children,
  stickyHead = false,
}: {
  children: React.ReactNode
  stickyHead?: boolean
}) {
  const { sentinel, stuck } = useHeadStuck(stickyHead)
  return (
    <div
      className={'glass-mid @container' + (stickyHead ? ' ledger-sticky' : '')}
      data-head-stuck={stickyHead && stuck ? 'true' : undefined}
    >
      <div ref={sentinel} aria-hidden="true" />
      <table className="w-full text-left text-[0.9375rem]">{children}</table>
    </div>
  )
}

export function VehicleCell({
  mode,
  row,
  nationChip = 'none',
}: {
  mode: string
  row: IllustratedRow
  /** `mobile`: show the flag chip only below md, where the Nation column folds
      into this cell. */
  nationChip?: 'none' | 'mobile'
}) {
  return (
    // The one cell that yields: max-w-0 + w-full makes the name truncate under
    // pressure instead of growing the table past a phone viewport.
    <td className="w-full max-w-0 py-2.5 pr-4 pl-5">
      <div className="flex items-center gap-2.5">
        <VehicleIcon src={row.vehicleImage} variant="ledger" />
        <div className="min-w-0 flex-1">
          <div className="truncate">
            {/* Wrapper span, not a utility on the chip: the unlayered
                .flag-chip display rule would win over `md:hidden`. */}
            {nationChip === 'mobile' && (
              <span className="mr-2 md:hidden">
                <NationFlag slug={row.nationSlug} />
              </span>
            )}
            <Link
              to="/$mode/vehicle/$slug"
              params={{ mode, slug: row.vehicleSlug }}
              className="font-medium no-underline hover:underline"
            >
              {row.vehicleName}
            </Link>
            {row.isDifficult && (
              <span
                className="ml-1.5 text-fg-faint"
                title="Difficult vehicle — higher qualifying kill bar"
              >
                ◆
              </span>
            )}
            <VehicleTags tags={row} />
          </div>
          <HolderLine row={row} />
        </div>
      </div>
    </td>
  )
}

/* Below md the Holder column folds to here, under the name it belongs to.
   Kills stays a column at every width — it is the number the page is scanned
   for, and its header is the only way to sort by it on a phone. */
function HolderLine({ row }: { row: IllustratedRow }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-fg-muted md:hidden">
      {isHeld(row) ? (
        <>
          <PlayerAvatar
            avatarUrl={row.holderAvatar}
            displayName={row.displayName}
            size={18}
          />
          <span className="min-w-0 truncate [&_a]:no-underline">
            <RecordName
              displayName={row.displayName}
              playerSlug={row.playerSlug}
              ignSnapshot={row.ignSnapshot}
              displayNameSnapshot={row.displayNameSnapshot}
            />
          </span>
        </>
      ) : (
        <span className="text-[0.6875rem] font-semibold tracking-[0.12em] text-[var(--accent-text)] uppercase">
          Open bounty
        </span>
      )}
      {row.br != null && (
        <span className="ml-auto shrink-0 pl-2 text-fg-faint sm:hidden">
          {formatBr(row.br)}
        </span>
      )}
    </div>
  )
}

export function NationCell({ row }: { row: LedgerVehicleRow }) {
  return (
    <td className="hidden py-2.5 pr-4 text-[0.8125rem] whitespace-nowrap text-fg-muted md:table-cell">
      <NationFlag slug={row.nationSlug} className="mr-2" />
      {row.nationName}
    </td>
  )
}

export function BrCell({ br }: { br: number | null }) {
  return (
    <td className="hidden py-2.5 pr-4 text-right text-[0.8125rem] text-fg-muted sm:table-cell">
      {br != null ? formatBr(br) : <span className="text-fg-faint">—</span>}
    </td>
  )
}

export function KillsCell({ kills }: { kills: number | null }) {
  return (
    <td className="py-2.5 pr-4 text-right">
      {kills != null ? (
        <span className="font-bold text-fg">{kills}</span>
      ) : (
        <span className="text-fg-faint">—</span>
      )}
    </td>
  )
}

/** The one definition of a held title; every surface counts and renders
    from this so headers and cells can never disagree. */
export function isHeld(
  row: LedgerVehicleRow,
): row is LedgerVehicleRow & { playerSlug: string; displayName: string } {
  return !!row.playerSlug && !!row.displayName
}

export function HolderCell({ row }: { row: IllustratedRow }) {
  return (
    <td className="hidden py-2.5 pr-5 md:table-cell [&_a]:no-underline [&_a:hover]:underline">
      <span className="flex items-center gap-2">
        {isHeld(row) ? (
          <>
            <PlayerAvatar
              avatarUrl={row.holderAvatar}
              displayName={row.displayName}
              size={22}
            />
            <span className="min-w-0 truncate">
              <RecordName
                displayName={row.displayName}
                playerSlug={row.playerSlug}
                ignSnapshot={row.ignSnapshot}
                displayNameSnapshot={row.displayNameSnapshot}
              />
            </span>
          </>
        ) : (
          <>
            {/* Reserved so the column keeps one text edge down the page. */}
            <span aria-hidden="true" className="w-[22px] shrink-0" />
            <span className="text-fg-faint">Open bounty</span>
          </>
        )}
      </span>
    </td>
  )
}

export function LedgerEmptyRow({
  colSpan,
  hasFilters,
  onReset,
}: {
  colSpan: number
  hasFilters: boolean
  onReset: () => void
}) {
  return (
    <tr className="border-t border-hairline-soft">
      <td colSpan={colSpan} className="px-5 py-12 text-center">
        <p className="text-fg-muted">
          {hasFilters
            ? 'No vehicles match these filters.'
            : 'No vehicles here yet.'}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="mt-4 rounded-[10px] border border-hairline px-3.5 py-1.5 text-[0.8125rem] font-medium text-fg-muted transition-colors duration-200 hover:border-[var(--hairline-hover)] hover:text-fg"
          >
            Reset filters
          </button>
        )}
      </td>
    </tr>
  )
}
