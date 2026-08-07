import { ImagePlus, MapPin, Plus } from 'lucide-react'
import { PlayerAvatar } from '#/components/player-avatar'
import { ClaimedChip } from '#/components/claimed-chip'
import { ProfileEnrichment } from '#/components/profile-enrichment'
import type { ProfileEnrichmentData } from '#/components/profile-enrichment'
import { CountryMark, ProfileLink } from '#/prototype/marks'
import type { LinkItem } from '#/prototype/marks'

/* THROWAWAY — profile-v2 prototype (#160). Three competing directions for the
   profile header, each making a different claim about what belongs where. */

export interface Case {
  displayName: string
  formerNames: string[]
  avatarUrl: string | null
  isClaimed: boolean
  country: { code: string; name: string } | null
  links: LinkItem[]
  isOwner: boolean
  mark: number
  records: { mode: string; vehicle: string; kills: number }[]
  stats: ProfileEnrichmentData
}

const ghost =
  'inline-flex items-center justify-center gap-1.5 rounded border border-hairline-soft px-3 py-1.5 text-sm font-semibold text-fg-muted transition-colors duration-200 hover:text-fg'

function NameRow({ c, size = 'text-2xl' }: { c: Case; size?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <h1 className={`${size} font-semibold text-balance`}>{c.displayName}</h1>
      {c.isClaimed && <ClaimedChip />}
    </div>
  )
}

function FormerNames({ c }: { c: Case }) {
  if (c.formerNames.length === 0) return null
  return (
    <span className="text-sm text-fg-faint">
      previously known as {c.formerNames.join(', ')}
    </span>
  )
}

function OwnerAvatarRow({ c }: { c: Case }) {
  if (!c.isOwner) return null
  return (
    <button type="button" className={ghost}>
      <ImagePlus size={15} aria-hidden />
      {c.avatarUrl ? 'Replace photo' : 'Upload photo'}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   A — THE CLUSTER
   One block. Everything about the person accretes under the name: identity
   line (country · former names) then the link row. The header IS the profile.
   ───────────────────────────────────────────────────────────────────────── */
export function DirectionA({ c }: { c: Case }) {
  return (
    <div className="glass-mid p-6 sm:p-7">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:gap-5">
        <PlayerAvatar
          avatarUrl={c.avatarUrl}
          displayName={c.displayName}
          size={84}
          eager
        />
        <div className="min-w-0 flex-1">
          <NameRow c={c} />
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
              <FormerNames c={c} />
            </p>
          )}
          {(c.links.length > 0 || c.isOwner) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
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
          )}
          {c.isOwner && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <OwnerAvatarRow c={c} />
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
      <ProfileEnrichment stats={c.stats} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   B — THE REGISTER  (the refusal)
   FACEIT's answer: the header holds the person and nothing else, so it looks
   identical for the unclaimed majority. Country and links move to their own
   zone — a labelled register panel, each row [mark] [text], one job each.
   ───────────────────────────────────────────────────────────────────────── */
export function DirectionB({ c }: { c: Case }) {
  const hasRegister = c.country != null || c.links.length > 0 || c.isOwner
  return (
    <>
      <div className="glass-mid p-6 sm:p-7">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
          <PlayerAvatar
            avatarUrl={c.avatarUrl}
            displayName={c.displayName}
            size={84}
            eager
          />
          <div className="min-w-0 flex-1">
            <NameRow c={c} />
            {c.formerNames.length > 0 && (
              <p className="mt-1">
                <FormerNames c={c} />
              </p>
            )}
            {c.isOwner && (
              <div className="mt-4">
                <OwnerAvatarRow c={c} />
              </div>
            )}
          </div>
        </div>
        <ProfileEnrichment stats={c.stats} />
      </div>

      {hasRegister && (
        <div className="glass-mid p-6 sm:p-7">
          <h2 className="section-label mb-4">About</h2>
          <dl className="space-y-4">
            {(c.country || c.isOwner) && (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <dt className="stat-label w-24 shrink-0 text-fg-muted">
                  Country
                </dt>
                <dd className="min-w-0 text-[0.9375rem] text-fg">
                  {c.country ? (
                    <CountryMark
                      code={c.country.code}
                      name={c.country.name}
                      size={22}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-sm text-fg-muted underline decoration-hairline underline-offset-2 hover:text-fg"
                    >
                      Set country
                    </button>
                  )}
                </dd>
              </div>
            )}
            {(c.links.length > 0 || c.isOwner) && (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <dt className="stat-label mt-2.5 w-24 shrink-0 text-fg-muted">
                  Links
                </dt>
                <dd className="grid min-w-0 flex-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {c.links.map((l) => (
                    <ProfileLink key={l.platform} item={l} mark={c.mark} stacked />
                  ))}
                  {c.isOwner && (
                    <button
                      type="button"
                      className="text-sm text-fg-muted underline decoration-hairline underline-offset-2 hover:text-fg"
                    >
                      {c.links.length > 0 ? 'Edit links' : 'Add links'}
                    </button>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   C — THE PLINTH
   Splits the difference on a claim: the country is identity, so it rides with
   the name; links are outbound, so they dock to the card's foot as their own
   full-width rail under a hairline. The card reads identity → record → where
   else to find them.
   ───────────────────────────────────────────────────────────────────────── */
export function DirectionC({ c }: { c: Case }) {
  const hasRail = c.links.length > 0 || c.isOwner
  return (
    <div className="glass-mid p-6 sm:p-7">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
        <PlayerAvatar
          avatarUrl={c.avatarUrl}
          displayName={c.displayName}
          size={84}
          eager
        />
        <div className="min-w-0 flex-1">
          <NameRow c={c} />
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
              <FormerNames c={c} />
            </p>
          )}
          {c.isOwner && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <OwnerAvatarRow c={c} />
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

      <ProfileEnrichment stats={c.stats} />

      {hasRail && (
        <div className="mt-6 border-t border-hairline-soft pt-5">
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
