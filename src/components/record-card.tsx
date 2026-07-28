import { AcquisitionWash } from '#/components/acquisition-wash'
import { RecordName } from '#/components/record-name'
import { VehicleLink } from '#/components/vehicle-link'
import { DifficultMark, isHeld } from '#/components/catalog-ledger'
import type { VehicleArtRow } from '#/components/catalog-ledger'
import { formatBr } from '#/lib/format'

export type RecordCardRow = VehicleArtRow

/* A title as a floating glass card, shared by the nation sheet's record wall
   and Browse's Spotlight. */
export function RecordCard({
  row,
  mode,
  mutedAcquisition,
}: {
  row: RecordCardRow
  mode: string
  /** Inside the special wall the tinted glass already says premium/squadron —
      the chips would repeat it on every card. Nowhere else: among ranked cards
      a lone gilded pane reads as a medal, not as an acquisition. */
  mutedAcquisition?: boolean
}) {
  const held = isHeld(row)
  const tags = mutedAcquisition
    ? { ...row, isPremium: false, isSquadron: false }
    : row
  return (
    <article className="glass-mid pane-lift relative flex flex-col px-3 pt-2.5 pb-3">
      {mutedAcquisition && <AcquisitionWash tags={row} className="-z-10" />}
      <header className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[0.9375rem] font-medium">
          <VehicleLink
            mode={mode}
            slug={row.vehicleSlug}
            name={row.vehicleName}
            tags={tags}
          />
          <DifficultMark show={row.isDifficult} />
          {/* The tinted glass is the sighted cue inside this wall; assistive
              tech still needs the words the muted chips no longer carry. */}
          {mutedAcquisition && (row.isPremium || row.isSquadron) && (
            <span className="sr-only">
              {[
                row.isPremium && 'Premium vehicle',
                row.isSquadron && 'Squadron vehicle',
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </span>
        <span className="text-[0.8125rem] whitespace-nowrap text-fg-faint">
          {row.br != null ? formatBr(row.br) : '—'}
        </span>
      </header>
      {row.vehicleImage ? (
        <img
          src={row.vehicleImage}
          alt=""
          loading="lazy"
          draggable={false}
          className={
            'vehicle-portrait mx-auto -mt-0.5 h-16' +
            (held ? '' : ' opacity-45 grayscale')
          }
        />
      ) : (
        <span aria-hidden="true" className="-mt-0.5 h-16" />
      )}
      <footer className="mt-1 border-t border-hairline-soft pt-1.5">
        {held && row.playerSlug && row.displayName ? (
          <p className="truncate text-[0.8125rem] text-fg-muted">
            <strong className="text-[1.0625rem] font-bold text-fg">
              {row.kills}
            </strong>
            <span className="stat-unit ml-1 text-[0.6875rem]">kills</span>
            <span className="mx-1.5 text-fg-faint">·</span>
            <RecordName
              displayName={row.displayName}
              playerSlug={row.playerSlug}
              ignSnapshot={row.ignSnapshot}
              displayNameSnapshot={row.displayNameSnapshot}
            />
          </p>
        ) : (
          <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-[var(--accent-text)] uppercase">
            Open bounty
          </p>
        )}
      </footer>
    </article>
  )
}
