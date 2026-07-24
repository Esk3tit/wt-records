import type { ReactElement } from 'react'
import type {
  NationCardModel,
  PlayerCardModel,
  VehicleCardModel,
} from '#/og/props/types'
import { VehicleCard } from '#/og/cards/vehicle-card'
import { NationCard } from '#/og/cards/nation-card'
import { PlayerCard } from '#/og/cards/player-card'
import { SiteCard } from '#/og/cards/site-card'

/** Model → card element. The one place route, golden tests, and fallback
    generator agree. `media` = pre-resolved bytes (vehicle art or Player avatar). */
export function cardElement(
  model: VehicleCardModel | NationCardModel | PlayerCardModel,
  media?: string | null,
): ReactElement {
  switch (model.kind) {
    case 'vehicle':
      return <VehicleCard {...model} art={media} />
    case 'nation':
      return <NationCard {...model} />
    case 'player':
      return <PlayerCard {...model} avatar={media} />
  }
}

export { SiteCard }
