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

/** Model → card element. One place the route, the golden tests, and the
    fallback generator all agree on which template renders which model. */
export function cardElement(
  model: VehicleCardModel | NationCardModel | PlayerCardModel,
  art?: string | null,
): ReactElement {
  switch (model.kind) {
    case 'vehicle':
      return <VehicleCard {...model} art={art} />
    case 'nation':
      return <NationCard {...model} />
    case 'player':
      return <PlayerCard {...model} />
  }
}

export { SiteCard }
