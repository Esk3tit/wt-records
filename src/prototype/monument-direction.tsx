import { ImagePlus, MapPin, Plus } from 'lucide-react'
import { CountUp } from '#/components/count-up'
import { NationFlag } from '#/components/nation-flag'
import { PlayerAvatar } from '#/components/player-avatar'
import { ClaimedChip } from '#/components/claimed-chip'
import { ProfileEnrichment } from '#/components/profile-enrichment'
import { CountryMark, ProfileLink } from '#/prototype/marks'
import type { Case } from '#/prototype/header-directions'

/* THROWAWAY — profile-v2 prototype (#160 follow-up).

   D — THE MONUMENT. C's structure, amplified with the one signature the profile
   header quietly opts out of: the Record Monument. DESIGN.md already gives the
   monument a kicker, an amber numeral (the page's single amber moment), a
   plaque line, a count-up and a glow — and the player's own share card already
   renders exactly this number as its hero. The page was the only surface
   stating it as a row you had to count. */

const ghost =
  'inline-flex items-center justify-center gap-1.5 rounded border border-hairline-soft px-3 py-1.5 text-sm font-semibold text-fg-muted transition-colors duration-200 hover:text-fg'

/* The plaque under the numeral: real evidence, in the monument's own register.
   With nothing currently held the monument inverts, as DESIGN.md requires —
   a hollow amber 0 is not a feat, and time at the top is. */
function PlayerMonument({ c }: { c: Case }) {
  const held = c.records.length
  const days = c.stats.longestHeld
    ? Math.round(c.stats.longestHeld.heldSeconds / 86400)
    : 0

  if (held === 0) {
    return (
      <div className="flex flex-col md:items-end md:text-right">
        <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
          Days at the top
        </p>
        <p className="text-[clamp(3.25rem,8vw,5rem)] leading-none font-bold tracking-[-0.03em] text-accent-text">
          <CountUp value={days} />
          <span className="stat-unit ml-2 text-[0.9375rem]">days</span>
        </p>
        <p className="mt-2 max-w-[16rem] text-sm text-fg-muted">
          No titles standing right now — every one of them is winnable back.
        </p>
      </div>
    )
  }

  const best = c.records[0]
  return (
    <div className="flex flex-col md:items-end md:text-right">
      <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
        Titles held
      </p>
      <p className="text-[clamp(3.25rem,8vw,5rem)] leading-none font-bold tracking-[-0.03em] text-accent-text">
        <CountUp value={held} />
        <span className="stat-unit ml-2 text-[0.9375rem]">
          {held === 1 ? 'record' : 'records'}
        </span>
      </p>
      <p className="mt-2 text-[1.0625rem] font-semibold">{best.vehicle}</p>
      <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
        {best.kills} kills · {best.mode}
      </p>
    </div>
  )
}

/* D2 — the same monument, with the hero and the plaque swapped. "Titles held"
   is 1–3 for almost every player, and a monumental 1 is ceremony without
   substance; days at the top has real range and is the stat the ledger is
   actually about. One shape for every player, no threshold. */
function PlayerMonumentDays({ c }: { c: Case }) {
  const held = c.records.length
  const days = c.stats.longestHeld
    ? Math.round(c.stats.longestHeld.heldSeconds / 86400)
    : 0
  return (
    <div className="flex flex-col md:items-end md:text-right">
      <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
        Days at the top
      </p>
      <p className="text-[clamp(3.25rem,8vw,5rem)] leading-none font-bold tracking-[-0.03em] text-accent-text">
        <CountUp value={days} />
        <span className="stat-unit ml-2 text-[0.9375rem]">days</span>
      </p>
      <p className="mt-2 text-[1.0625rem] font-semibold">
        {held === 0
          ? 'No titles standing'
          : `${held} ${held === 1 ? 'title' : 'titles'} held now`}
      </p>
      {held > 0 && (
        <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
          best is {c.records[0].kills} kills · {c.records[0].vehicle}
        </p>
      )}
    </div>
  )
}

export function DirectionD({
  c,
  wash = true,
  hero = 'titles',
}: {
  c: Case
  wash?: boolean
  hero?: 'titles' | 'days'
}) {
  const hasRail = c.links.length > 0 || c.isOwner
  // The hall this player lives in: the nation they hold the most titles in.
  const homeNation = c.stats.nationSpread[0]?.slug

  return (
    <div className="glass-thick relative p-6 sm:p-8 md:p-10">
      {/* z-0 stacking context so the wash's z-1 stays contained */}
      <div
        className="absolute inset-0 z-0 overflow-hidden rounded-[26px]"
        aria-hidden="true"
      >
        <div className="monument-glow" />
        {/* The hero wash's mask assumes a wide pane; below md it lands as a
            hard vertical seam, so it simply doesn't run there. */}
        {wash && homeNation && (
          <NationFlag
            slug={homeNation}
            variant="wash-hero"
            className="hidden md:block"
          />
        )}
      </div>

      <div className="relative grid items-start gap-8 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
          <PlayerAvatar
            avatarUrl={c.avatarUrl}
            displayName={c.displayName}
            size={84}
            eager
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl font-semibold text-balance">
                {c.displayName}
              </h1>
              {c.isClaimed && <ClaimedChip />}
            </div>
            {(c.country || c.formerNames.length > 0) && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-fg-muted">
                {c.country && (
                  <CountryMark code={c.country.code} name={c.country.name} />
                )}
                {c.country && c.formerNames.length > 0 && (
                  <span className="text-fg-faint" aria-hidden>
                    ·
                  </span>
                )}
                {c.formerNames.length > 0 && (
                  <span className="text-fg-faint">
                    previously known as {c.formerNames.join(', ')}
                  </span>
                )}
              </p>
            )}
            {c.isOwner && (
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <button type="button" className={ghost}>
                  <ImagePlus size={15} aria-hidden />
                  {c.avatarUrl ? 'Replace photo' : 'Upload photo'}
                </button>
                {!c.country && (
                  <button type="button" className={ghost}>
                    <MapPin size={15} aria-hidden />
                    Set country
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {hero === 'days' ? (
          <PlayerMonumentDays c={c} />
        ) : (
          <PlayerMonument c={c} />
        )}
      </div>

      <div className="relative">
        <ProfileEnrichment stats={c.stats} />
      </div>

      {hasRail && (
        <div className="relative mt-6 border-t border-hairline-soft pt-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {c.links.map((l) => (
              <ProfileLink key={l.platform} item={l} mark={c.mark} />
            ))}
            {c.isOwner && (
              <button type="button" className={ghost}>
                <Plus size={15} aria-hidden />
                {c.links.length > 0 ? 'Edit links' : 'Add links'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
