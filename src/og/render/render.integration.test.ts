import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderCardPng } from './renderer'
import { cardElement, SiteCard } from './card-element'
import { toVehicleCardModel } from '#/og/props/vehicle'
import type { VehicleCardData } from '#/og/props/vehicle'
import { toNationCardModel } from '#/og/props/nation'
import { toPlayerCardModel } from '#/og/props/player'
import { COUNTRIES } from '#/lib/countries'

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
      portrait: null,
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
    history: [],
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
            portrait: null,
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
          history: [],
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

/* The country pill. Its absent case is the majority — most Players are
   unclaimed and can never have one — so what is asserted first is that the
   pill's existence costs a card without one nothing at all. */

function playerCard(
  displayName: string,
  opts: Parameters<typeof toPlayerCardModel>[1] = {},
) {
  return cardElement(
    toPlayerCardModel(
      {
        player: { displayName },
        records: [
          { mode: 'grb', kills: 34, vehicleName: 'IS-2', nationSlug: 'ussr' },
          { mode: 'grb', kills: 12, vehicleName: 'M4A1', nationSlug: 'usa' },
        ],
      },
      opts,
    ),
  )
}

/* The card at its tallest without a country. A country may cost the caption,
   but it may never push the stack lower than this — measured, so a layout
   change moves the bar with it rather than freezing a number here. */
const worstWithoutCountry = () =>
  lowestInkRow(
    playerCard('Александрдлинноеимяфамилия', {
      previouslyKnownAs: 'ОченьДлинноеСтароеИмя',
    }),
  )

/** The five the pill has least room for, derived so the set stays the extreme. */
const WIDEST_COUNTRIES = [...COUNTRIES]
  .sort((a, b) => b.name.length - a.name.length)
  .slice(0, 5)
  .map((c) => c.code)

/* Was the caption actually drawn? Two captions of the SAME length lay out
   identically, so only their glyphs can differ — identical bytes mean the text
   never reached the card. Comparing against no caption at all cannot tell you:
   the block is vertically centred, so its absence moves the whole card. */
async function captionIsDrawn(displayName: string, countryCode?: string) {
  const render = (previouslyKnownAs: string) =>
    renderCardPng(playerCard(displayName, { previouslyKnownAs, countryCode }))
  const [a, b] = await Promise.all([render('AAAAAAAAAA'), render('MMMMMMMMMM')])
  return Buffer.compare(Buffer.from(a), Buffer.from(b)) !== 0
}

const INK_LEVEL = 150 // above the pane's own fill, so only text and marks count
const MARGIN = 60 // skips the pane's lit edges, which run the card's full height
const INK_RUN = 3 // a run, so one stray antialiased pixel is not a row of ink

async function lowestInkRow(node: Parameters<typeof renderCardPng>[0]) {
  const { data, info } = await sharp(Buffer.from(await renderCardPng(node)))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let y = info.height - 1; y >= 0; y--) {
    let bright = 0
    for (let x = MARGIN; x < info.width - MARGIN; x++)
      if (data[y * info.width + x] > INK_LEVEL) bright++
    if (bright > INK_RUN) return y
  }
  return -1
}

describe('the country pill', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('leaves a card without a country byte-for-byte unchanged', async () => {
    /* No hole and no reflow. `countryCode: null` would be the same model, so
       it proves nothing — a code the pill cannot resolve is what actually
       exercises the branch and still has to leave the card untouched. */
    const name = 'Александрдлинноеимяфамилия'
    const opts = { previouslyKnownAs: 'ОченьДлинноеСтароеИмя' }
    const [absent, unresolvable] = await Promise.all([
      renderCardPng(playerCard(name, opts)),
      renderCardPng(playerCard(name, { ...opts, countryCode: 'ZZ' })),
    ])
    expect(Buffer.from(absent).equals(Buffer.from(unresolvable))).toBe(true)

    const withCountry = await renderCardPng(
      playerCard(name, { ...opts, countryCode: 'JP' }),
    )
    // And a country really does draw something, or the above is trivial.
    expect(Buffer.from(absent).equals(Buffer.from(withCountry))).toBe(false)
  })

  it('renders the pill beside the name', () =>
    expectValidCard(playerCard('Ace', { countryCode: 'US' })))

  it('issues no fetch, even for a card whose every remote asset is gone', async () => {
    // ADR 0009's crash mode: a fetch failing mid-render takes the whole card
    // down. The flag is inlined, so the renderer has nothing to ask for.
    const fetchSpy = vi.fn(() => {
      throw new Error('the renderer must never fetch')
    })
    vi.stubGlobal('fetch', fetchSpy)
    await expectValidCard(
      cardElement(
        toPlayerCardModel(
          {
            player: { displayName: 'Ace' },
            records: [
              {
                mode: 'grb',
                kills: 34,
                vehicleName: 'IS-2',
                nationSlug: 'ussr',
              },
            ],
          },
          { avatarKey: 'avatars/1/a.webp', countryCode: 'JP' },
        ),
        // The avatar failed to resolve: the Medallion stands in, and the pill
        // is still there.
        null,
      ),
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('holds the frame under a long name, a former name, and a country', async () => {
    // A byline under the name broke here. The card may drop the caption, but
    // the record and the hero below it must sit where they always have.
    const [floor, lowest] = await Promise.all([
      worstWithoutCountry(),
      lowestInkRow(
        playerCard('ОченьДлинноеИмя', {
          countryCode: WIDEST_COUNTRIES[0],
          previouslyKnownAs: 'СтароеДлинноеИмя',
        }),
      ),
    ])
    expect(floor).toBeGreaterThan(0)
    expect(lowest).toBeLessThanOrEqual(floor)
  })

  it('keeps the former-name caption beside a country', async () => {
    // The tombstone caption is the one exception to current-names-only, so a
    // country must not quietly cost it on a name that still has the room.
    for (const name of ['Ace', 'Пётр Железняков']) {
      expect(await captionIsDrawn(name), name).toBe(true)
      expect(
        await captionIsDrawn(name, WIDEST_COUNTRIES[0]),
        `${name} + country`,
      ).toBe(true)
    }
  })

  it('drops the caption whole, never in part, when the name took two lines', async () => {
    /* Two lines of name plus a country leave no room for a caption as well.
       Pinned because it is a decision, not an accident: what a reader must
       never see is half a line of it, or a card missing its record. */
    const twoLineName = 'CommanderSteelWolf'
    expect(await captionIsDrawn(twoLineName)).toBe(true)
    expect(await captionIsDrawn(twoLineName, 'JP')).toBe(false)

    const [floor, lowest] = await Promise.all([
      worstWithoutCountry(),
      lowestInkRow(
        playerCard(twoLineName, {
          countryCode: 'JP',
          previouslyKnownAs: 'FormerCallsign',
        }),
      ),
    ])
    expect(lowest).toBeLessThanOrEqual(floor)
  })

  it('holds the frame for the widest country names in the list', async () => {
    // The pill is one line by construction, so the longest name is the only
    // case that can overflow the column. Taken from the list, not from memory:
    // a hardcoded set silently stops being the extreme when the list changes.
    const floor = await worstWithoutCountry()
    for (const code of WIDEST_COUNTRIES) {
      const lowest = await lowestInkRow(
        playerCard('Пётр Железняков', { countryCode: code }),
      )
      expect(lowest, code).toBeLessThanOrEqual(floor)
    }
  })
})
