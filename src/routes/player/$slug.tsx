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
import type { ClaimViewer } from '#/components/claim-panel'
import { db } from '#/db'
import {
  effectiveAvatarKey,
  getPlayer,
  playerMergeRedirect,
} from '#/db/queries'
import { hasAuthCookie, getSessionUser } from '#/auth/supabase-server'
import { providerAvatarUrl } from '#/auth/profile'
import { viewerHasPendingClaim } from '#/claims/claims'
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
  const pending = claimed
    ? false
    : await viewerHasPendingClaim(db, user.id, player.id)
  return {
    signedIn: true,
    isOwner: player.userId === user.id,
    pending,
    canClaim: !claimed && !pending,
    // Offered only when a claim is actually possible — never leaked otherwise.
    providerAvatarUrl: !claimed && !pending ? providerAvatarUrl(user) : null,
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
      return { profile: null, redirectTo, viewer: null }
    }
    const claimed = found.player.userId != null
    const avatarKey = effectiveAvatarKey(found.player)
    const viewer = await resolveClaimViewer(found.player)
    return {
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
        avatarKey,
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
    return { profile: result.profile, viewer: result.viewer }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {}
    const model = toPlayerCardModel(
      {
        player: { displayName: loaderData.profile.displayName },
        records: loaderData.profile.records,
      },
      { avatarKey: loaderData.profile.avatarKey },
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
  const { profile, viewer } = Route.useLoaderData()
  const formerNames = profile.aliases.filter(
    (name) => name !== profile.displayName,
  )

  return (
    <section className="mt-6 space-y-5">
      <div className="glass-mid p-6 sm:p-7">
        <div className="flex items-center gap-5">
          <PlayerAvatar
            avatarUrl={profile.avatarUrl}
            displayName={profile.displayName}
            size={84}
            eager
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl font-semibold text-balance">
                {profile.displayName}
              </h1>
              {profile.isClaimed && <ClaimedChip />}
            </div>
            {formerNames.length > 0 && (
              <p className="mt-1 text-sm text-fg-faint">
                previously known as {formerNames.join(', ')}
              </p>
            )}
            {viewer.signedIn && viewer.isOwner && (
              <OwnerAvatarControls
                playerId={profile.id}
                hasAvatar={profile.hasAvatar}
              />
            )}
          </div>
        </div>

        <ClaimPanel
          key={profile.id}
          playerId={profile.id}
          slug={profile.slug}
          isClaimed={profile.isClaimed}
          viewer={viewer}
        />
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
