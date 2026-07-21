import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db'
import { getPlayer, mergedFromName, playerMergeRedirect } from '#/db/queries'
import { toPlayerCardModel } from '#/og/props/player'
import { playerCardPath } from '#/og/urls'
import { cardElement } from '#/og/render/card-element'
import {
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
            // carrying the old slug so the survivor card can name it.
            const survivor = await playerMergeRedirect(db, slug)
            if (survivor) {
              return movedResponse(`${playerCardPath(survivor)}?from=${slug}`)
            }
            return notFoundResponse()
          }
          const model = toPlayerCardModel(
            { player: player.player, records: player.records },
            { previouslyKnownAs: await previouslyKnownAs(from, slug) },
          )
          return cardResponse(await renderCardPng(cardElement(model)))
        } catch (err) {
          reportCardError(`player ${slug}`, err)
          return fallbackResponse()
        }
      },
    },
  },
})
