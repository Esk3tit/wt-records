import { RecordName } from '#/components/record-name'
import { VehicleLink } from '#/components/vehicle-link'
import { isHeld } from '#/components/catalog-ledger'
import type { LedgerVehicleRow } from '#/components/catalog-ledger'
import { VEHICLE_CLASSES } from '#/lib/vehicle-classes'
import { formatBr, formatRank } from '#/lib/format'

export interface NationGridRow extends LedgerVehicleRow {
  rank: number | null
  class: string
  vehicleImage: string | null
}

/* The nation sheet's record wall: every title as a floating glass card —
   vehicle portrait over the pane, the record line beneath — split into the
   tech-tree wall and the premium-&-special wall. Ranks render as shared rows
   spanning both walls so a rank starts on one baseline everywhere. An unheld
   title is an OPEN BOUNTY: the page's amber, the chase itself. */

const isSpecial = (r: NationGridRow) =>
  r.isPremium || r.isSquadron || r.isEvent || r.isRemoved

const classOrder = (c: string) => {
  const i = (VEHICLE_CLASSES as readonly string[]).indexOf(c)
  return i === -1 ? VEHICLE_CLASSES.length : i
}

// Class lines, then BR, then name — the wiki's column feel without lineage.
const byClassBrName = (a: NationGridRow, b: NationGridRow) =>
  classOrder(a.class) - classOrder(b.class) ||
  (a.br ?? Infinity) - (b.br ?? Infinity) ||
  a.vehicleName.localeCompare(b.vehicleName)

function bandsByRank(rows: NationGridRow[]) {
  const bands = new Map<number | null, NationGridRow[]>()
  for (const r of rows) bands.set(r.rank, [...(bands.get(r.rank) ?? []), r])
  for (const list of bands.values()) list.sort(byClassBrName)
  return bands
}

function BandRule({
  rank,
  rows,
}: {
  rank: number | null
  rows: NationGridRow[]
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
        {rank != null ? `Rank ${formatRank(rank)}` : 'Unranked'}
      </span>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-linear-to-r from-[var(--hairline)] to-transparent"
      />
      <span className="text-[0.6875rem] font-medium text-fg-faint">
        {rows.filter(isHeld).length} of {rows.length} held
      </span>
    </div>
  )
}

function RecordCard({
  row,
  mode,
  mutedAcquisition,
}: {
  row: NationGridRow
  mode: string
  /** Inside the special wall the tinted glass already says premium/squadron —
      the chips would repeat it on every card. */
  mutedAcquisition?: boolean
}) {
  const held = isHeld(row)
  const tags = mutedAcquisition
    ? { ...row, isPremium: false, isSquadron: false }
    : row
  // Acquisition reads as the card's own material, wiki-style: gilded glass
  // for premium, service green for squadron. Event/removed stay neutral.
  const tint = row.isPremium
    ? 'bg-linear-to-b from-[#F0B94A5C] to-[#F0B94A1A]'
    : row.isSquadron
      ? 'bg-linear-to-b from-[#6FA05C66] to-[#6FA05C21]'
      : null
  return (
    <article className="glass-mid pane-lift relative flex flex-col px-3 pt-2.5 pb-3">
      {tint && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 rounded-[inherit] ${tint}`}
        />
      )}
      <header className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[0.9375rem] font-medium">
          <VehicleLink
            mode={mode}
            slug={row.vehicleSlug}
            name={row.vehicleName}
            tags={tags}
          />
          {row.isDifficult && (
            <span
              className="ml-1.5 text-fg-faint"
              title="Difficult vehicle — higher qualifying kill bar"
            >
              ◆
            </span>
          )}
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

export function NationGrid({
  mode,
  rows,
  hasFilters,
  onReset,
}: {
  mode: string
  rows: NationGridRow[]
  hasFilters: boolean
  onReset: () => void
}) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
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
      </div>
    )
  }

  const treeBands = bandsByRank(rows.filter((r) => !isSpecial(r)))
  const specialBands = bandsByRank(rows.filter(isSpecial))
  const hasSpecial = specialBands.size > 0
  const ranks = [
    ...new Set([...treeBands.keys(), ...specialBands.keys()]),
  ].sort((a, b) => (a ?? Infinity) - (b ?? Infinity))

  return (
    <div>
      {hasSpecial && (
        <div className="hidden xl:flex xl:gap-6">
          <h2 className="min-w-0 flex-1 text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
            Tech tree
          </h2>
          <h2 className="w-[420px] shrink-0 text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
            Premium &amp; special
          </h2>
        </div>
      )}
      {ranks.map((rank) => {
        const tree = treeBands.get(rank) ?? []
        const special = specialBands.get(rank) ?? []
        return (
          <div
            key={rank ?? 'unranked'}
            className="mt-5 flex flex-col gap-4 first-of-type:mt-3 xl:flex-row xl:items-start xl:gap-6"
          >
            <div className="min-w-0 flex-1">
              {tree.length > 0 && (
                <>
                  <BandRule rank={rank} rows={tree} />
                  <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                    {tree.map((r) => (
                      <RecordCard key={r.vehicleSlug} row={r} mode={mode} />
                    ))}
                  </div>
                </>
              )}
            </div>
            {hasSpecial && (
              <div className="xl:w-[420px] xl:shrink-0">
                {special.length > 0 && (
                  <>
                    {/* The wall headers only exist at xl; when the layout
                        stacks, this names the special band inside the rank. */}
                    <p className="mb-1.5 text-[0.6875rem] font-semibold tracking-[0.2em] text-fg-faint uppercase xl:hidden">
                      Premium &amp; special
                    </p>
                    <BandRule rank={rank} rows={special} />
                    <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5 xl:grid-cols-2">
                      {special.map((r) => (
                        <RecordCard
                          key={r.vehicleSlug}
                          row={r}
                          mode={mode}
                          mutedAcquisition
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
