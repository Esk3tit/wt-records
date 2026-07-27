import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'
import type { NationStanding } from '#/db/queries'

const METAL_TEXT = ['text-gold', 'text-silver', 'text-bronze']
const METAL_PANE = ['pane-gold', 'pane-silver', 'pane-bronze']

/* The wash sets its own z-index to clear a pane's content; scoping it to a
   layer of its own keeps the metal frost painting above it, so rank outranks
   nationality on a row that carries both. */
function WashLayer({ slug }: { slug: string }) {
  return (
    <span aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
      <NationFlag slug={slug} variant="wash" className="flag-wash--soft" />
    </span>
  )
}

/* Ten nations inside a 13-point completion band render as ten identical bars,
   so the fill stays honest at 0–100 while the label carries what actually
   separates them: how many titles are still unclaimed. */
function CompletionBar({ nation }: { nation: NationStanding }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint-strong"
      >
        <span
          className="block h-full rounded-full bg-[var(--ink-faint)]"
          style={{ width: `${nation.completionPct}%` }}
        />
      </span>
      <span className="shrink-0 text-[0.9375rem] font-bold tabular-nums text-fg">
        {nation.openBounties}
        <span className="stat-unit ml-1 text-[0.6875rem]">left</span>
      </span>
    </div>
  )
}

/* Spoken, the row is a run of bare numerals — "2 left 104 of 106" tells a
   screen reader nothing the layout tells everyone else. The label says the
   same thing as a sentence; the visible text stays exactly as it is. */
function rowLabel(nation: NationStanding, contested: boolean): string {
  const holder = nation.holder
    ? ` Most titles: ${nation.holder.name}, ${nation.holder.titles}.`
    : ' No titles held yet.'
  if (!contested)
    return `${nation.name}. ${nation.openBounties} titles open.${holder}`
  const place = nation.rank != null ? `, rank ${nation.rank}` : ''
  return `${nation.name}${place}. ${nation.coveredVehicles} of ${nation.eligibleVehicles} titles held, ${nation.openBounties} left.${holder}`
}

function StandingRow({
  mode,
  nation,
  contested,
}: {
  mode: string
  nation: NationStanding
  contested: boolean
}) {
  const metalIndex = nation.rank != null ? nation.rank - 1 : -1
  const metal = metalIndex >= 0 && metalIndex < 3 ? metalIndex : -1

  return (
    <li>
      <Link
        to="/$mode/nation/$slug"
        params={{ mode, slug: nation.slug }}
        aria-label={rowLabel(nation, contested)}
        className={`relative block border-b border-hairline-soft px-5 py-5 no-underline transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)] sm:px-7 sm:py-6 ${metal >= 0 ? METAL_PANE[metal] : ''}`}
      >
        <WashLayer slug={nation.slug} />
        {/* Narrow screens stack — place, nation and the held count on one line,
            then the holder and the bar across the full width, because a
            truncated holder name defeats the point of naming them. Wide screens
            put all four in one ledger line. */}
        <div className="relative z-[1] grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 sm:gap-x-6 lg:grid-cols-[2.5rem_16rem_minmax(0,1fr)_auto] lg:gap-y-1">
          <span
            className={`col-start-1 row-start-1 self-center text-right text-2xl leading-none font-bold tracking-[-0.02em] tabular-nums sm:text-3xl lg:row-span-2 ${metal >= 0 ? METAL_TEXT[metal] : 'text-fg-faint'}`}
          >
            {nation.rank ?? ''}
          </span>

          <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-2.5 text-lg font-semibold text-fg sm:text-xl">
            <NationFlag slug={nation.slug} />
            <span className="truncate">{nation.name}</span>
          </span>

          <div className="col-start-2 col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2">
            {nation.holder ? (
              <>
                <p className="stat-label text-fg-faint">Most titles</p>
                <p className="mt-0.5 flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-[1.0625rem] font-semibold text-fg">
                    {nation.holder.name}
                  </span>
                  <span className="stat-unit shrink-0 text-[0.75rem] text-fg-faint">
                    {nation.holder.titles} titles
                  </span>
                </p>
              </>
            ) : (
              <p className="text-[0.8125rem] text-fg-faint italic">Unclaimed</p>
            )}
          </div>

          {/* The bar earns its column only where places exist; an empty mode
              would render ten identical zeroes. */}
          {contested && (
            <div className="col-start-2 col-span-2 row-start-3 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-center">
              <CompletionBar nation={nation} />
            </div>
          )}

          <p className="col-start-3 row-start-1 justify-self-end text-right lg:col-start-4 lg:row-span-2 lg:self-center">
            <span className="text-2xl leading-none font-bold tracking-[-0.02em] tabular-nums text-fg sm:text-3xl lg:text-4xl">
              {contested ? nation.coveredVehicles : nation.openBounties}
            </span>
            <span className="stat-unit ml-1.5 text-[0.8125rem]">
              {contested ? `of ${nation.eligibleVehicles}` : 'open'}
            </span>
          </p>
        </div>
      </Link>
    </li>
  )
}

/** The Mode's nation standings as one ranked wall: place, nation, its
    most-titles Holder, what's left to claim, and titles held. A Mode nobody has
    scored in inverts — no places, ordered by the size of the unclaimed prize. */
export function NationStandings({
  mode,
  contested,
  nations,
}: {
  mode: string
  contested: boolean
  nations: NationStanding[]
}) {
  if (nations.length === 0)
    return (
      <div className="glass-mid px-6 py-10 text-center">
        <p className="text-fg-muted">
          No nations are in this mode's catalog yet.
        </p>
      </div>
    )

  return (
    <div className="glass-mid overflow-hidden">
      <ul>
        {nations.map((nation) => (
          <StandingRow
            key={nation.slug}
            mode={mode}
            nation={nation}
            contested={contested}
          />
        ))}
      </ul>
    </div>
  )
}
