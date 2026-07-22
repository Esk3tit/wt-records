import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db'
import { getMode, getNationCard } from '#/db/queries'
import { toNationCardModel } from '#/og/props/nation'
import { cardElement } from '#/og/render/card-element'
import {
  cardResponse,
  fallbackResponse,
  notFoundResponse,
  renderCardPng,
  reportCardError,
  stripPng,
} from '#/og/render/renderer'

export const Route = createFileRoute('/og/$mode/nation/$slug')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const mode = params.mode
        const slug = stripPng(params.slug)
        try {
          const m = await getMode(db, mode)
          if (!m || !m.isLive) return notFoundResponse()
          const data = await getNationCard(db, mode, slug)
          if (!data) return notFoundResponse()
          const model = toNationCardModel(mode, data)
          return cardResponse(await renderCardPng(cardElement(model)))
        } catch (err) {
          reportCardError(`nation ${mode}/${slug}`, err)
          return fallbackResponse()
        }
      },
    },
  },
})
