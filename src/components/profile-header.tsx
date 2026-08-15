import { PlayerAvatar } from '#/components/player-avatar'
import { ClaimedChip } from '#/components/claimed-chip'
import { ClaimPanel } from '#/components/claim-panel'
import { MonumentLight } from '#/components/monument-light'
import { OwnerAvatarControls } from '#/components/owner-avatar-controls'
import { OwnerCountryControls } from '#/components/owner-country-controls'
import { OwnerLinkControls } from '#/components/owner-link-controls'
import { PlayerCountry } from '#/components/player-country'
import { PlayerMonument, hasMonument } from '#/components/player-monument'
import { ProfileEnrichment } from '#/components/profile-enrichment'
import { ProfileLinks } from '#/components/profile-links'
import { renderLinks } from '#/links/render'
import type { ClaimViewer } from '#/components/claim-panel'
import type { ProfileEnrichmentData } from '#/components/profile-enrichment'
import type { CountryMark } from '#/lib/country-mark-server'

export interface ProfileHeaderPlayer {
  id: number
  slug: string
  displayName: string
  aliases: string[]
  avatarUrl: string | null
  hasAvatar: boolean
  country: CountryMark | null
  countryCode: string | null
  links: ReadonlyArray<{ platform: string; handle: string }>
  isClaimed: boolean
  titlesHeld: number
}

/* The Plinth. Split on a claim about kind, not about space: the country is
   identity, so it rides with the name; links are outbound, so they dock to the
   foot. The empty case is the page an unclaimed Player has always had, and
   since that is the common case, "nothing renders a hole" is the property this
   composition is judged on. */
export function ProfileHeader({
  player,
  viewer,
  enrichment,
}: {
  player: ProfileHeaderPlayer
  viewer: ClaimViewer
  enrichment: ProfileEnrichmentData
}) {
  const formerNames = player.aliases.filter(
    (name) => name !== player.displayName,
  )
  const standing = {
    titlesHeld: player.titlesHeld,
    longestHeld: enrichment.longestHeld,
  }
  const isOwner = viewer.signedIn && viewer.isOwner

  return (
    <div className="glass-mid relative p-6 sm:p-7">
      <MonumentLight standing={standing} />

      {/* The identity column's desktop air is spent, not inherited: measured, a
          name leaves ~800px of void beside a monument only 193px wide, so the
          strip moves up into it and the card reads as two columns rather than
          as one with a hole. Placed rather than reordered — down the page the
          order stays identity → monument → what kind of holder they are.

          The second column only exists where the monument does. A grid still
          spends the gutter beside an empty track, so declaring it either way
          took 32px off the width of the page with nothing in it — which is the
          common one, and the one this composition promised to leave alone. */}
      <div
        className={`relative grid items-start gap-x-8 gap-y-6 ${
          hasMonument(standing) ? 'md:grid-cols-[minmax(0,1fr)_auto]' : ''
        }`}
      >
        {/* Stacked below sm: beside an 84px disc a phone leaves the name
            ~180px, and a long one shatters rather than wrapping. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5 md:col-start-1 md:row-start-1">
          <PlayerAvatar
            avatarUrl={player.avatarUrl}
            displayName={player.displayName}
            size={84}
            eager
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {/* A name can be one unbroken token. `anywhere`, not
                  `break-word`: only the former lets the flex item shrink. */}
              <h1 className="text-2xl font-semibold wrap-anywhere text-balance">
                {player.displayName}
              </h1>
              {player.isClaimed && <ClaimedChip />}
            </div>
            {/* One line of who they are. No placeholder, no globe: a neutral
                mark reads as a statement. */}
            {(player.country != null || formerNames.length > 0) && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
                {player.country && <PlayerCountry country={player.country} />}
                {formerNames.length > 0 && (
                  <span className="text-fg-faint">
                    {/* Bound to what follows it, never trailing what precedes:
                        wrapped to its own line at 320px, a separator left on
                        the country's line dangles there. */}
                    {player.country && (
                      <span aria-hidden="true" className="mr-2">
                        ·
                      </span>
                    )}
                    previously known as {formerNames.join(', ')}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Places itself into this grid across both rows — see PlayerMonument:
            the rule between them is the plinth, and it is this card's own. */}
        <PlayerMonument {...standing} />

        {/* Replaces the strip's own top margin: the grid's row gap is what
            spaces it here. */}
        <ProfileEnrichment
          stats={enrichment}
          placement="md:col-start-1 md:row-start-2"
        />
      </div>

      <div className="relative">
        {/* Below the identity row, not in it: that column now shares its own
            row with the monument, and these would take the name's width as
            well as the height that strands the avatar beside it. */}
        {isOwner && (
          // Keyed like ClaimPanel: the router keeps these mounted across a slug
          // change, and in-flight state belongs to one player. Keyed once, on
          // the group — three siblings sharing one key is a key collision, and
          // React is free to drop or duplicate them.
          <div key={`owner-${player.id}`}>
            <OwnerAvatarControls
              playerId={player.id}
              hasAvatar={player.hasAvatar}
            />
            <OwnerCountryControls
              playerId={player.id}
              countryCode={player.countryCode}
            />
          </div>
        )}

        <ClaimPanel
          key={`claim-${player.id}`}
          playerId={player.id}
          slug={player.slug}
          isClaimed={player.isClaimed}
          viewer={viewer}
        />

        {/* Last on the card, and below the stats: on a records site the first
            thing under a player's name is not where else to watch them. */}
        <ProfileLinks links={renderLinks(player.links)} />

        {/* The owner's authoring sits with their rail rather than up beside the
            avatar, because the empty rail is the only moment a player is ever
            told links exist. */}
        {isOwner && (
          <OwnerLinkControls
            key={`links-${player.id}`}
            playerId={player.id}
            links={player.links}
          />
        )}
      </div>
    </div>
  )
}
