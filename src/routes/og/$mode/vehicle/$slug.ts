import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db'
import { getMode, getVehicle } from '#/db/queries'
import { toVehicleCardModel } from '#/og/props/vehicle'
import { cardElement } from '#/og/render/card-element'
import { resolveArt } from '#/og/render/art'
import {
  cardResponse,
  fallbackResponse,
  notFoundResponse,
  renderCardPng,
  reportCardError,
  stripPng,
} from '#/og/render/renderer'

// The public URL is /og/$mode/vehicle/$slug.png; the route captures the whole
// last segment, so the handler strips the .png extension off the slug.
export const Route = createFileRoute('/og/$mode/vehicle/$slug')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const mode = params.mode
        const slug = stripPng(params.slug)
        try {
          const m = await getMode(db, mode)
          // Non-live modes emit the static site card from the page; their OG
          // route 404s so a coming-soon Mode never unfurls an empty card.
          if (!m || !m.isLive) return notFoundResponse()
          const data = await getVehicle(db, mode, slug)
          if (!data) return notFoundResponse()
          const model = toVehicleCardModel(mode, data)
          const art = await resolveArt(model.artUrl)
          return cardResponse(await renderCardPng(cardElement(model, art)))
        } catch (err) {
          reportCardError(`vehicle ${mode}/${slug}`, err)
          return fallbackResponse()
        }
      },
    },
  },
})
