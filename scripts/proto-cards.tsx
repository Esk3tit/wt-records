import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { renderCardPng } from '#/og/render/renderer'
import { toPlayerCardModel } from '#/og/props/player'
import { PlayerCard } from '#/og/cards/player-card'
import { CardS1, CardS2, CardS3 } from '#/prototype/player-card-directions'

/* THROWAWAY — profile-v2 prototype (#160). */

const out = '.proto-cards'
mkdirSync(out, { recursive: true })

const base = toPlayerCardModel({
  player: { displayName: 'Пётр Железняков-Оболенский' },
  records: [
    { mode: 'grb', kills: 34, vehicleName: 'IS-2', nationSlug: 'ussr' },
    { mode: 'grb', kills: 21, vehicleName: 'T-34-85', nationSlug: 'ussr' },
    { mode: 'grb', kills: 12, vehicleName: 'M4A1', nationSlug: 'usa' },
    { mode: 'arb', kills: 17, vehicleName: 'Bf 109 F-4', nationSlug: 'germany' },
  ],
})

const AVATAR = `data:image/png;base64,${readFileSync(
  new URL('../src/og/assets/fallback.png', import.meta.url),
).toString('base64')}`

const FR = { code: 'FR', name: 'France' }
const stress = { ...base, previouslyKnownAs: 'PetrZ, Железняков' }

const cards = [
  ['today', PlayerCard, null],
  ['s1-byline', CardS1, FR],
  ['s2-statcell', CardS2, FR],
  ['s3-nameplate', CardS3, FR],
  ['s1-byline-nocountry', CardS1, null],
  ['s2-statcell-nocountry', CardS2, null],
  ['s3-nameplate-nocountry', CardS3, null],
] as const

const stressCards = [
  ['s1-byline-stress', CardS1],
  ['s2-statcell-stress', CardS2],
  ['s3-nameplate-stress', CardS3],
] as const

for (const [name, C, country] of cards) {
  const el = <C {...base} avatar={AVATAR} country={country} />
  writeFileSync(`${out}/${name}.png`, await renderCardPng(el))
  console.log(`${out}/${name}.png`)
}

for (const [name, C] of stressCards) {
  const el = <C {...stress} avatar={AVATAR} country={FR} />
  writeFileSync(`${out}/${name}.png`, await renderCardPng(el))
  console.log(`${out}/${name}.png`)
}
