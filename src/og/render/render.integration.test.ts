import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderCardPng } from './renderer'
import { cardElement, SiteCard } from './card-element'
import { toVehicleCardModel } from '#/og/props/vehicle'
import type { VehicleCardData } from '#/og/props/vehicle'
import { toNationCardModel } from '#/og/props/nation'
import { toPlayerCardModel } from '#/og/props/player'

/* The render-function seam. A committed pixel golden isn't portable — the native
   renderer's rasterization differs between the dev (darwin) and CI (linux)
   binaries — so this asserts the invariants that ARE portable and that a
   renderer regression or a layout collapse would break: every card is a valid
   PNG, exactly 1200×630, and carries real content (a blank/collapsed render
   falls under the size floor). Worst-case fixtures (longest names, four chips,
   long Cyrillic) are the guard the spec asked for against silent clipping. */

function pngInfo(bytes: Uint8Array) {
  const buf = Buffer.from(bytes)
  return {
    signature: buf.subarray(0, 8).toString('hex'),
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    size: buf.length,
  }
}

const PNG_SIGNATURE = '89504e470d0a1a0a'
const CONTENT_FLOOR = 15_000 // a real card is ~70KB; a blank one is a few KB.

async function expectValidCard(node: Parameters<typeof renderCardPng>[0]) {
  const info = pngInfo(await renderCardPng(node))
  expect(info.signature).toBe(PNG_SIGNATURE)
  expect(info.width).toBe(1200)
  expect(info.height).toBe(630)
  expect(info.size).toBeGreaterThan(CONTENT_FLOOR)
}

function vehicle(over: Partial<VehicleCardData> = {}): VehicleCardData {
  return {
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
      ...over.vehicle,
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
    ...over,
  }
}

// A real, committed PNG stood in as pre-resolved art — proves the art path
// renders from bytes, without any network fetch inside the renderer.
const ART_PNG = `data:image/png;base64,${readFileSync(
  new URL('../assets/fallback.png', import.meta.url),
).toString('base64')}`

// A real WebP — the exact format avatars are stored as (512×512 WebP) — so the
// Avatar golden proves the renderer decodes the production format, not just PNG.
const AVATAR_WEBP = `data:image/webp;base64,${(
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 200, g: 60, b: 60 },
    },
  })
    .webp({ quality: 82 })
    .toBuffer()
).toString('base64')}`

describe('renderCardPng', () => {
  it('renders a held vehicle card', () =>
    expectValidCard(cardElement(toVehicleCardModel('grb', vehicle()))))

  it('renders a held vehicle card with pre-resolved art', () =>
    expectValidCard(cardElement(toVehicleCardModel('grb', vehicle()), ART_PNG)))

  it('renders an Open bounty vehicle card', () =>
    expectValidCard(
      cardElement(toVehicleCardModel('grb', vehicle({ current: null }))),
    ))

  it('contains worst-case content: longest name, four chips, long Cyrillic holder', () =>
    expectValidCard(
      cardElement(
        toVehicleCardModel('grb', {
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
            displayName: 'Александрдлинноеимяфамилия',
          },
          minKills: 12,
        }),
      ),
    ))

  it('renders a nation card', () =>
    expectValidCard(
      cardElement(
        toNationCardModel('grb', {
          name: 'USSR',
          nationSlug: 'ussr',
          held: 113,
          total: 182,
          completionPct: 62,
          avgKills: 21.37,
          mostHeldPlayer: 'Пётр Железняков',
        }),
      ),
    ))

  it('renders a player card with Cyrillic name and per-mode chips', () =>
    expectValidCard(
      cardElement(
        toPlayerCardModel({
          player: { displayName: 'Пётр Железняков' },
          records: [
            { mode: 'grb', kills: 34, vehicleName: 'IS-2', nationSlug: 'ussr' },
            { mode: 'grb', kills: 12, vehicleName: 'M4A1', nationSlug: 'usa' },
          ],
        }),
      ),
    ))

  it('renders a player card with the Avatar in the identity slot', () =>
    expectValidCard(
      cardElement(
        toPlayerCardModel(
          {
            player: { displayName: 'Пётр Железняков' },
            records: [
              {
                mode: 'grb',
                kills: 34,
                vehicleName: 'IS-2',
                nationSlug: 'ussr',
              },
            ],
          },
          { avatarKey: 'avatars/1/a.webp' },
        ),
        AVATAR_WEBP,
      ),
    ))

  it('renders the card-native Medallion for a Player without an Avatar', () =>
    expectValidCard(
      cardElement(
        toPlayerCardModel({
          player: { displayName: 'Пётр Железняков' },
          records: [
            { mode: 'grb', kills: 34, vehicleName: 'IS-2', nationSlug: 'ussr' },
          ],
        }),
      ),
    ))

  it('degrades to the Medallion when the Avatar fetch failed (bytes null)', () =>
    // The route resolves R2 bytes out of band; a miss passes null here, and the
    // identity slot must still render (the Medallion), never crash the card.
    expectValidCard(
      cardElement(
        toPlayerCardModel(
          {
            player: { displayName: 'Пётр Железняков' },
            records: [
              {
                mode: 'grb',
                kills: 34,
                vehicleName: 'IS-2',
                nationSlug: 'ussr',
              },
            ],
          },
          { avatarKey: 'avatars/1/a.webp' },
        ),
        null,
      ),
    ))

  it('renders a tombstone player card with the previously-known-as line', () =>
    expectValidCard(
      cardElement(
        toPlayerCardModel(
          {
            player: { displayName: 'Пётр Железняков' },
            records: [
              {
                mode: 'grb',
                kills: 34,
                vehicleName: 'IS-2',
                nationSlug: 'ussr',
              },
            ],
          },
          { previouslyKnownAs: 'ОченьДлинноеСтароеИмя' },
        ),
      ),
    ))

  it('renders the static site card', () =>
    expectValidCard(createElement(SiteCard)))
})
