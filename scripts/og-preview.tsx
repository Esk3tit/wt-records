import { mkdirSync, writeFileSync } from 'node:fs'
import { renderCardPng } from '#/og/render/renderer'
import { cardElement, SiteCard } from '#/og/render/card-element'
import { toVehicleCardModel } from '#/og/props/vehicle'
import { toNationCardModel } from '#/og/props/nation'
import { toPlayerCardModel } from '#/og/props/player'

const out = process.argv[2] ?? './.og-preview'
mkdirSync(out, { recursive: true })

async function write(name: string, node: Parameters<typeof renderCardPng>[0]) {
  writeFileSync(`${out}/${name}.png`, await renderCardPng(node))
  console.log(`  ${out}/${name}.png`)
}

const vehicleHeld = toVehicleCardModel('grb', {
  vehicle: {
    name: 'M4A1 (76) W Sherman',
    class: 'medium',
    nationSlug: 'usa',
    nationName: 'USA',
    isEvent: false,
    isPremium: false,
    isSquadron: false,
    isRemoved: false,
    image: null,
  },
  br: 5.7,
  current: {
    kills: 21,
    patch: '2.31',
    patchName: 'Kings of Battle',
    verifiedAt: '2026-07-01',
    displayName: 'Пётр Железняков',
  },
  minKills: 15,
})

const vehicleWorst = toVehicleCardModel('grb', {
  vehicle: {
    name: 'Panzerkampfwagen VI Ausf. B Tiger II (Sla.16)',
    class: 'heavy',
    nationSlug: 'germany',
    nationName: 'Germany',
    isEvent: true,
    isPremium: true,
    isSquadron: false,
    isRemoved: true,
    image: null,
  },
  br: 8.0,
  current: {
    kills: 7,
    patch: '2.29',
    patchName: 'Air Superiority',
    verifiedAt: '2026-06-01',
    displayName: 'Александрдлинноеимя',
  },
  minKills: 12,
})

const vehicleOpen = toVehicleCardModel('grb', {
  vehicle: {
    name: 'Object 279 (early)',
    class: 'heavy',
    nationSlug: 'ussr',
    nationName: 'USSR',
    isEvent: true,
    isPremium: false,
    isSquadron: false,
    isRemoved: false,
    image: null,
  },
  br: 8.3,
  current: null,
  minKills: 18,
})

const nation = toNationCardModel('grb', {
  name: 'USSR',
  nationSlug: 'ussr',
  held: 113,
  total: 182,
  completionPct: 62,
  avgKills: 21.37,
  mostHeldPlayer: 'Пётр Железняков',
})

const player = toPlayerCardModel({
  player: { displayName: 'Пётр Железняков' },
  records: [
    { mode: 'grb', kills: 34, vehicleName: 'IS-2', nationSlug: 'ussr' },
    { mode: 'grb', kills: 21, vehicleName: 'T-34-85', nationSlug: 'ussr' },
    { mode: 'grb', kills: 12, vehicleName: 'M4A1', nationSlug: 'usa' },
  ],
})

const AVATAR = `data:image/png;base64,${(await import('node:fs'))
  .readFileSync(new URL('../src/og/assets/fallback.png', import.meta.url))
  .toString('base64')}`

console.log('rendering →', out)
await write('vehicle-held', cardElement(vehicleHeld))
await write('vehicle-worst', cardElement(vehicleWorst))
await write('vehicle-open', cardElement(vehicleOpen))
await write('nation', cardElement(nation))
await write('player', cardElement(player))
await write('player-avatar', cardElement(player, AVATAR))
await write('site', <SiteCard />)
console.log('done')
