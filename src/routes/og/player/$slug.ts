import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db'
import {
  effectiveAvatarKey,
  getPlayer,
  mergedFromName,
  playerMergeRedirect,
} from '#/db/queries'
import { toPlayerCardModel } from '#/og/props/player'
import { assetUrlIfConfigured } from '#/storage/urls'
import { playerCardRedirect } from '#/og/urls'
import { cardElement } from '#/og/render/card-element'
import { resolveArt } from '#/og/render/art'
import {
  NO_STORE_CACHE_CONTROL,
  cardResponse,
  fallbackResponse,
  movedResponse,
  notFoundResponse,
  renderCardPng,
  reportCardError,
  stripPng,
} from '#/og/render/renderer'

// A survivor card reached through a Merge shows "previously known as <old name>"
// — the single deliberate exception to cards-show-current-names-only. `from` is
// only trusted when that slug actually merges into this survivor, so it can't be
// used to caption an arbitrary name onto someone else's card.
async function previouslyKnownAs(
  from: string | null,
  survivorSlug: string,
): Promise<string | null> {
  if (!from || from === survivorSlug) return null
  const [name, resolvesTo] = await Promise.all([
    mergedFromName(db, from),
    playerMergeRedirect(db, from),
  ])
  return name && resolvesTo === survivorSlug ? name : null
}

export const Route = createFileRoute('/og/player/$slug')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = stripPng(params.slug)
        const from = new URL(request.url).searchParams.get('from')
        try {
          const player = await getPlayer(db, slug)
          if (!player) {
            // Merge tombstone → permanent redirect to the survivor's card,
            // carrying the old slug (for the name) and the survivor's version so
            // the redirect target is cache-busted like a direct visit.
            const survivor = await playerMergeRedirect(db, slug)
            if (survivor) {
              const s = await getPlayer(db, survivor)
              // The redirect target renders with the "previously known as"
              // caption (from=slug), so its version must include it too — else
              // the `?v=` wouldn't match the content the target self-computes.
              const version = s
                ? toPlayerCardModel(
                    { player: s.player, records: s.records },
                    {
                      previouslyKnownAs: await previouslyKnownAs(
                        slug,
                        survivor,
                      ),
                      avatarKey: effectiveAvatarKey(s.player),
                    },
                  ).version
                : undefined
              return movedResponse(playerCardRedirect(survivor, slug, version))
            }
            return notFoundResponse()
          }
          const avatarKey = effectiveAvatarKey(player.player)
          const avatarUrl = avatarKey ? assetUrlIfConfigured(avatarKey) : null
          // Independent I/O (DB name lookup vs. R2 avatar fetch) on a path
          // scrapers hit directly — resolve them together.
          const [pka, avatar] = await Promise.all([
            previouslyKnownAs(from, slug),
            avatarUrl ? resolveArt(avatarUrl) : null,
          ])
          const model = toPlayerCardModel(
            { player: player.player, records: player.records },
            { previouslyKnownAs: pka, avatarKey },
          )
          const bytes = await renderCardPng(cardElement(model, avatar))
          // A claimed Avatar that failed to resolve degrades to the Medallion;
          // serve that uncacheable so a transient R2 miss can't freeze the
          // fallback into caches under the avatar's unchanged URL.
          const avatarMissed = avatarUrl != null && avatar == null
          return cardResponse(
            bytes,
            avatarMissed ? NO_STORE_CACHE_CONTROL : undefined,
          )
        } catch (err) {
          reportCardError(`player ${slug}`, err)
          return fallbackResponse()
        }
      },
    },
  },
})
