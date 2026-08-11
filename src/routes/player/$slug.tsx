import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { VehicleTags } from '#/components/vehicle-tags'
import { PlayerAvatar } from '#/components/player-avatar'
import { ClaimedChip } from '#/components/claimed-chip'
import { ClaimPanel } from '#/components/claim-panel'
import { OwnerAvatarControls } from '#/components/owner-avatar-controls'
import { OwnerCountryControls } from '#/components/owner-country-controls'
import { PlayerCountry } from '#/components/player-country'
import { PlayerMonument, hasMonument } from '#/components/player-monument'
import { ProfileEnrichment } from '#/components/profile-enrichment'
import type { ClaimViewer } from '#/components/claim-panel'
import { db } from '#/db'
import {
  effectiveAvatarKey,
  effectiveCountry,
  getPlayer,
  getPlayerEnrichment,
  playerMergeRedirect,
} from '#/db/queries'
import { resolveCountryMark } from '#/lib/country-mark-server'
import { hasAuthCookie, getSessionUser } from '#/auth/supabase-server'
import { providerAvatarUrl } from '#/auth/profile'
import { viewerClaimCommitment, viewerClaimState } from '#/claims/claims'
import { resolveAmendmentViewer } from '#/claims/viewer'
import { assetUrlIfConfigured } from '#/storage/urls'
import { toPlayerCardModel } from '#/og/props/player'
import { playerUnfurl } from '#/og/copy'
import { playerCardUrl } from '#/og/urls'
import { cardMeta } from '#/og/meta'

/** The viewer's relationship to this Player — only for a signed-in visitor;
    anonymous requests skip the auth round-trip entirely and stay cacheable. */
async function resolveClaimViewer(player: {
  id: number
  userId: string | null
}): Promise<ClaimViewer> {
  if (!hasAuthCookie()) return { signedIn: false }
  const user = await getSessionUser()
  if (!user) return { signedIn: false }
  const claimed = player.userId != null
  const claimState = claimed
    ? 'none'
    : await viewerClaimState(db, user.id, player.id)
  // Only asked when the form would otherwise render: what they hold elsewhere
  // is the difference between offering a claim and offering a dead end.
  const commitment =
    !claimed && claimState === 'none'
      ? await viewerClaimCommitment(db, user.id)
      : null
  const canClaim = !claimed && claimState === 'none' && commitment == null
  return {
    signedIn: true,
    isOwner: player.userId === user.id,
    claimState,
    commitment,
    canClaim,
    // Offered only when a claim is actually possible — never leaked otherwise.
    providerAvatarUrl: canClaim ? providerAvatarUrl(user) : null,
  }
}

const loadPlayer = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data }) => {
    // Per-viewer claim state below — a shared cache must never serve one
    // visitor's response to another (or an anon response to a signed-in user).
    setResponseHeader('Cache-Control', 'private, no-store')
    setResponseHeader('Vary', 'Cookie')

    const found = await getPlayer(db, data)
    if (!found) {
      const redirectTo = await playerMergeRedirect(db, data)
      return { profile: null, redirectTo, viewer: null, enrichment: null }
    }
    const claimed = found.player.userId != null
    const countryCode = effectiveCountry(found.player)
    const [viewer, enrichment, amendmentViewer] = await Promise.all([
      resolveClaimViewer(found.player),
      getPlayerEnrichment(db, found.player.id),
      resolveAmendmentViewer(),
    ])
    const avatarKey = effectiveAvatarKey(found.player, amendmentViewer)
    return {
      enrichment,
      profile: {
        // player.userId (an auth uuid) never crosses to the client.
        id: found.player.id,
        slug: found.player.slug,
        displayName: found.player.displayName,
        aliases: found.aliases,
        records: found.records,
        avatarUrl: avatarKey ? assetUrlIfConfigured(avatarKey) : null,
        // DB truth, independent of whether the asset host is configured, so the
        // owner's controls reflect the stored state, not the served URL.
        hasAvatar: avatarKey != null,
        // The share card is excluded from the viewer predicate, so its version
        // is derived from the REVIEWED key even here, on the owner's own page.
        // Versioning it off what they alone can see would let their own visit
        // render and publicly edge-cache an unreviewed picture under a fresh
        // ?v= — the one surface the site propagates off-site.
        cardAvatarKey: effectiveAvatarKey(found.player),
        // Resolved server-side (all 250 marks stay off the client), so a code
        // the list has since dropped renders as nothing at all.
        country: resolveCountryMark(countryCode),
        // Not redundant with country.code, though it reads that way: this is
        // what the row holds even when that no longer resolves. Deriving the
        // picker from the resolved mark instead cost the owner the ability to
        // clear a dropped code — the field looked clean because it was empty.
        countryCode,
        isClaimed: claimed,
      },
      redirectTo: null,
      viewer,
    }
  })

export const Route = createFileRoute('/player/$slug')({
  loader: async ({ params }) => {
    const result = await loadPlayer({ data: params.slug })
    if (result.redirectTo) {
      // Merged player: permanent redirect straight to the survivor.
      throw redirect({
        to: '/player/$slug',
        params: { slug: result.redirectTo },
        statusCode: 301,
      })
    }
    if (!result.profile) throw notFound()
    return {
      profile: result.profile,
      viewer: result.viewer,
      enrichment: result.enrichment,
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {}
    const model = toPlayerCardModel(
      {
        player: { displayName: loaderData.profile.displayName },
        records: loaderData.profile.records,
      },
      { avatarKey: loaderData.profile.cardAvatarKey },
    )
    const { title, description } = playerUnfurl(model)
    return {
      meta: cardMeta({
        title,
        description,
        image: playerCardUrl(params.slug, { version: model.version }),
      }),
    }
  },
  component: PlayerProfile,
})

function PlayerProfile() {
  const { profile, viewer, enrichment } = Route.useLoaderData()
  const formerNames = profile.aliases.filter(
    (name) => name !== profile.displayName,
  )
  const standing = {
    titlesHeld: profile.records.length,
    longestHeld: enrichment.longestHeld,
  }

  return (
    <section className="mt-6 space-y-5">
      <div className="glass-mid relative p-6 sm:p-7">
        {/* Measured: a pane narrower than it is tall cuts the glow's ramp into a
            hard vertical seam, so it runs only where the pane is wide. */}
        {hasMonument(standing) && (
          <div
            className="absolute inset-0 z-0 hidden overflow-hidden rounded-[inherit] md:block"
            aria-hidden="true"
          >
            <div className="monument-glow" />
          </div>
        )}

        {/* The identity column's desktop air is accepted, not filled: this
            card's next fact belongs in the strip below, not beside a name. */}
        <div className="relative grid items-start gap-8 md:grid-cols-[1fr_auto]">
          {/* Stacked below sm: beside an 84px disc a phone leaves the name
              ~180px, and a long one shatters rather than wrapping. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <PlayerAvatar
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
              size={84}
              eager
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {/* A name can be one unbroken token. `anywhere`, not
                    `break-word`: only the former lets the flex item shrink. */}
                <h1 className="text-2xl font-semibold wrap-anywhere text-balance">
                  {profile.displayName}
                </h1>
                {profile.isClaimed && <ClaimedChip />}
              </div>
              {/* No placeholder, no globe: a neutral mark reads as a statement. */}
              {profile.country && (
                <p className="mt-1">
                  <PlayerCountry country={profile.country} />
                </p>
              )}
              {formerNames.length > 0 && (
                <p className="mt-1 text-sm text-fg-faint">
                  previously known as {formerNames.join(', ')}
                </p>
              )}
            </div>
          </div>

          <PlayerMonument {...standing} />
        </div>

        <div className="relative">
          {/* Below the identity row, not in it: that column now shares its own
              row with the monument, and these would take the name's width as
              well as the height that strands the avatar beside it. */}
          {viewer.signedIn && viewer.isOwner && (
            <>
              {/* Keyed like ClaimPanel: the router keeps this mounted across a
                  slug change, and in-flight state belongs to one player. */}
              <OwnerAvatarControls
                key={profile.id}
                playerId={profile.id}
                hasAvatar={profile.hasAvatar}
              />
              <OwnerCountryControls
                key={profile.id}
                playerId={profile.id}
                countryCode={profile.countryCode}
              />
            </>
          )}

          <ProfileEnrichment stats={enrichment} />

          <ClaimPanel
            key={profile.id}
            playerId={profile.id}
            slug={profile.slug}
            isClaimed={profile.isClaimed}
            viewer={viewer}
          />
        </div>
      </div>

      <div className="glass-mid p-6 sm:p-7">
        <h2 className="section-label mb-4">Current records</h2>
        {profile.records.length === 0 ? (
          <p className="text-sm text-fg-faint">No current records yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {profile.records.map((r) => (
              <li
                key={`${r.mode}-${r.vehicleSlug}`}
                className="flex items-center gap-3 rounded-[10px] px-2 py-1.5 hover:bg-[var(--row-hover)]"
              >
                <span className="w-11 shrink-0 text-xs font-medium tracking-wide text-fg-faint uppercase">
                  {r.mode.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    to="/$mode/vehicle/$slug"
                    params={{ mode: r.mode, slug: r.vehicleSlug }}
                    className="decoration-hairline underline-offset-2 hover:decoration-current"
                  >
                    {r.vehicleName}
                  </Link>
                  <VehicleTags tags={r} />
                </span>
                <span className="shrink-0 font-semibold text-fg">
                  {r.kills}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
