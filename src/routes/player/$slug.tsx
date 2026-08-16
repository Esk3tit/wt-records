import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { VehicleTags } from '#/components/vehicle-tags'
import { ProfileHeader } from '#/components/profile-header'
import type { User } from '@supabase/supabase-js'
import type { ClaimViewer } from '#/components/claim-panel'
import { db } from '#/db'
import {
  effectiveAvatarKey,
  effectiveCountry,
  effectiveLinks,
  getPlayer,
  getPlayerEnrichment,
  getPlayerLinks,
  playerMergeRedirect,
} from '#/db/queries'
import { resolveCountryMark } from '#/lib/country-mark-server'
import { getSessionUser } from '#/auth/supabase-server'
import { providerAvatarUrl } from '#/auth/profile'
import { viewerClaimState, viewerIsCommitted } from '#/claims/claims'
import { loadAmendmentViewer } from '#/claims/amendments'
import { assetUrlIfConfigured } from '#/storage/urls'
import { toPlayerCardModel } from '#/og/props/player'
import { playerUnfurl } from '#/og/copy'
import { playerCardUrl } from '#/og/urls'
import { cardMeta } from '#/og/meta'

/** The viewer's relationship to this Player. The session is validated once for
    the page and handed in: this and the Avatar shadow both need it, and each
    resolving its own would cost two round-trips to the auth server. */
async function resolveClaimViewer(
  player: { id: number; userId: string | null },
  user: User | null,
): Promise<ClaimViewer> {
  if (!user) return { signedIn: false }
  const claimed = player.userId != null
  const claimState = claimed
    ? 'none'
    : await viewerClaimState(db, user.id, player.id)
  // Asked only when the form would otherwise render: a User already holding a
  // Claim (or waiting on one) is offered nothing here rather than a dead end.
  const committedElsewhere =
    !claimed && claimState === 'none'
      ? await viewerIsCommitted(db, user.id)
      : false
  const canClaim = !claimed && claimState === 'none' && !committedElsewhere
  return {
    signedIn: true,
    isOwner: player.userId === user.id,
    claimState,
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
    // Anonymous requests skip the auth round-trip entirely (getSessionUser
    // answers null off the cookie alone), so a visitor pays nothing for either.
    const user = await getSessionUser()
    const [viewer, enrichment, shadowed, links] = await Promise.all([
      resolveClaimViewer(found.player, user),
      getPlayerEnrichment(db, found.player.id),
      user ? loadAmendmentViewer(db, user.id) : null,
      getPlayerLinks(db, found.player.id),
    ])
    const avatarKey = effectiveAvatarKey(found.player, shadowed)
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
        // Deliberately the reviewed key, even for the owner: the share card is
        // outside the viewer predicate (see /og/player/$slug), so its version
        // must be too, or their own visit would cache an unreviewed one.
        cardAvatarKey: effectiveAvatarKey(found.player),
        // Resolved server-side (all 250 marks stay off the client), so a code
        // the list has since dropped renders as nothing at all.
        country: resolveCountryMark(countryCode),
        // Not redundant with country.code, though it reads that way: this is
        // what the row holds even when that no longer resolves. Deriving the
        // picker from the resolved mark instead cost the owner the ability to
        // clear a dropped code — the field looked clean because it was empty.
        countryCode,
        // Rendered for anonymous visitors too: gating them would defeat the
        // shareability that motivated the breadth, and gains nothing since
        // anyone can make an account.
        links: effectiveLinks(found.player, links),
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

  return (
    <section className="mt-6 space-y-5">
      <ProfileHeader
        player={{ ...profile, titlesHeld: profile.records.length }}
        viewer={viewer}
        enrichment={enrichment}
      />

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
