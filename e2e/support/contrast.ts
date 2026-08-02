import type { Page } from '@playwright/test'
import { deepestScroll, readerScrollsTo } from './nav'

/** What a piece of ink measured against the surface it actually sits on. */
export interface InkReading {
  label: string
  /** Enough of the element to go and find it — a label alone repeats. */
  where: string
  /** The ink's own contrast against its worst pixel of backdrop. */
  ratio: number
  /** The AA floor this size and weight has to clear: 4.5, or 3 when large. */
  needs: number
  ink: string
  backdrop: string
  font: string
  /** The most solidly this run paints any one pixel, 0–1. Short of solid it was
      not measured at all and `ratio` is `Infinity` — see `unreadable`. */
  coverage: number
}

type Rgba = [r: number, g: number, b: number, a: number]

interface Target {
  label: string
  where: string
  ink: Rgba
  needs: number
  font: string
  rects: { x: number; y: number; w: number; h: number }[]
}

/** Panes here are translucent glass over a scene and the ink carries its own
    alpha, so neither side of the ratio can be read off a token.

    Three screenshots, because a glyph box is mostly not glyph. `blank` gives the
    backdrop under the type, which sampling with the type still painted could
    never see. `black` and `white` differ only where the type paints, so their
    difference is the coverage each pixel actually receives — and over vehicle
    art or a flag wash the gaps between strokes are a different picture from the
    strokes, which is how a whole-page sweep invents failures nobody can see. */
export async function readInk(
  page: Page,
  root: string,
  /** Anything WCAG asks nothing of — a logotype under 1.4.3, say. */
  exempt: string,
): Promise<InkReading[]> {
  await probe(page, root, 'ink')
  await quiesced(page)
  const targets = await page.evaluate(collectTargets, { root, exempt })
  if (!targets.length) throw new Error(`no ink to measure under ${root}`)

  /* Only the ground the type stands on is worth photographing. A whole viewport
     four times over, at every depth of every route, is most of this harness's
     cost and none of its answer. */
  const box = bounds(targets)
  const shot = async () =>
    (await page.screenshot({ clip: box })).toString('base64')
  const shots = {} as Record<Paint, string>
  for (const state of PAINTS) {
    await probe(page, root, state)
    shots[state] = await shot()
  }
  /* Three shots only compose into one reading if they are of the same page:
     vehicle art decoding between them moves the ground under the type, and the
     mask then marks pixels a glyph never touched — which is how a sweep reports
     full-strength ink failing on a pane it never sat on. So the first shot is
     taken again last, and any pixel the two disagree on is dropped rather than
     believed. Per pixel, not per page: glass corners composite a hair
     differently frame to frame, and a pane's rounded edge has no bearing on
     whether the type inside it can be read. */
  await probe(page, root, 'blank')
  const steady = await shot()
  await probe(page, root, 'release')

  return page.evaluate(sampleBackdrops, { targets, shots, steady, box })
}

/** The one rectangle every glyph box fits inside, in CSS pixels. */
function bounds(targets: Target[]) {
  const rects = targets.flatMap((t) => t.rects)
  const x = Math.floor(Math.min(...rects.map((r) => r.x)))
  const y = Math.floor(Math.min(...rects.map((r) => r.y)))
  return {
    x,
    y,
    width: Math.ceil(Math.max(...rects.map((r) => r.x + r.w))) - x,
    height: Math.ceil(Math.max(...rects.map((r) => r.y + r.h))) - y,
  }
}

/** Art still arriving is a backdrop still changing, so the deferred images are
    called in first: a ledger's silhouettes and avatars load as the reader
    reaches them, and one landing between two shots moves the ground under the
    type. Bounded anyway — the stability check is what actually has to hold. */
async function quiesced(page: Page) {
  await page.evaluate(() => {
    for (const img of document.images) img.loading = 'eager'
  })
  await page
    .waitForFunction(
      () =>
        document.fonts.status === 'loaded' &&
        [...document.images].every((i) => i.complete),
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => {})
}

const PROBE = 'ink-probe'

/** The three paints the type is forced through, and the colour each forces. */
const PAINT = { blank: 'transparent', black: '#000', white: '#fff' } as const
type Paint = keyof typeof PAINT
const PAINTS = Object.keys(PAINT) as Paint[]

/* One sheet rewritten by id, not a tag added and dropped per reading: a removal
   that had not landed yet would measure still-transparent ink as a perfect 1:1.
   Every state but `release` also freezes transitions, because the nav animates
   its colours and a faded probe gets read halfway. */
async function probe(
  page: Page,
  root: string,
  state: 'ink' | Paint | 'release',
) {
  await page.evaluate(
    ({ scope, id, want, paints }) => {
      const sheet =
        document.getElementById(id) ??
        document.head.appendChild(
          Object.assign(document.createElement('style'), { id }),
        )
      /* Everything, not just the scope: the scene behind the pane carries
         embers on randomised delays, and a backdrop that moves between the
         reading and the screenshot is a different backdrop. */
      const frozen = `*, *::before, *::after {
        transition: none !important; animation: none !important; }`
      const paint = paints[want as keyof typeof paints]
      sheet.textContent =
        want === 'release'
          ? ''
          : want === 'ink'
            ? frozen
            : /* `fill` only on the elements that paint type with it — the
                 Medallion's monogram is an SVG `text`, and forcing fill on the
                 shapes too would blank the very disc it has to be read on. */
              `${frozen} ${scope}, ${scope} * { color: ${paint} !important;
                 -webkit-text-fill-color: ${paint} !important; }
               ${scope} text, ${scope} tspan { fill: ${paint} !important; }`
    },
    { scope: root, id: PROBE, want: state, paints: PAINT },
  )
  // Two frames: one for the style to land, one for it to have been painted.
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  )
}

export function faultsInInk(readings: InkReading[]): string[] {
  return readings
    .filter((r) => r.ratio < r.needs)
    .map(
      (r) =>
        `${r.label} — ${r.ratio.toFixed(2)}:1 (needs ${r.needs}:1), ` +
        `${r.ink} on ${r.backdrop}, ${r.font}, ${r.where}`,
    )
}

/** Floods the Spatial Scene with one flat colour, leaving the scrim and the
    glass above it untouched. Depths on real routes only prove those routes;
    this bounds the scene instead, so the panes hold for scenery — and pages —
    that do not exist yet.

    That the flood landed *behind* the scrim is asserted rather than assumed,
    because in front of it every ink on the page reads against its own colour
    and passes. Reading the two z-indexes back would only restate the
    stylesheet, so the check is on the pixel that actually rendered: over a
    flood the scrim tints, so a corner of the page comes back some other colour
    than the one poured in. Equal means the veil is not above it. */
export async function pinScene(page: Page, colour: string) {
  const poured = await page.evaluate((c) => {
    const scene = document.querySelector<HTMLElement>('.scene')
    if (!scene || !document.querySelector('.scene-scrim'))
      throw new Error('the scene never rendered')
    for (const child of scene.children)
      (child as HTMLElement).style.display = 'none'
    scene.style.background = c

    const swatch = Object.assign(document.createElement('span'), {
      style: `color:${c}`,
    })
    document.body.append(swatch)
    const resolved = getComputedStyle(swatch).color
    swatch.remove()
    return resolved
  }, colour)

  const corner = await page.screenshot({
    clip: { x: 0, y: 0, width: 4, height: 4 },
  })
  const rendered = await page.evaluate(async (shot: string) => {
    const image = new Image()
    image.src = `data:image/png;base64,${shot}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  }, corner.toString('base64'))

  if (rendered === poured)
    throw new Error('the flood covered the scrim instead of sitting under it')
}

/** The runs no ratio was taken from, because something is painted over them.
    A guard that only asserts on faults would pass for a pane nobody could
    measure, so the tests that own a surface assert on this too. */
export function unreadable(readings: InkReading[]): string[] {
  return readings
    .filter((r) => !isFinite(r.ratio))
    .map((r) => `${r.label} — covered to ${r.coverage.toFixed(2)}, ${r.where}`)
}

/** Which of the sites a page was visited *for* produced no reading at all.
    A whole-page sweep cannot assert `unreadable` is empty — text sliding under
    the nav is legitimately unmeasured on every route — so the cover against a
    vacuous pass is naming what each route owes and checking it arrived. Rename
    a class and the sweep goes on passing while measuring nothing; this is what
    notices. */
export function unmeasured(readings: InkReading[], sites: string[]): string[] {
  const took = readings.filter((r) => isFinite(r.ratio))
  return sites.filter((s) => !took.some((r) => r.where.includes(s)))
}

/** Walks a page the way a reader does, keeping each run's least-margin reading.
    Shared, because the nav's guard and the content guard differ only in what
    they point at and what they wait for. */
export async function worstDownThePage(
  page: Page,
  {
    root = 'main',
    exempt = '',
    depths,
    settle,
  }: {
    root?: string
    exempt?: string
    depths: number[]
    settle?: () => Promise<void>
  },
): Promise<InkReading[]> {
  const floor = await deepestScroll(page)
  const worst = new Map<string, InkReading>()
  for (const depth of depths.filter((d) => d <= floor)) {
    await readerScrollsTo(page, depth)
    await settle?.()
    for (const r of await readInk(page, root, exempt)) {
      const seen = worst.get(r.label + r.where)
      // By margin, not by ratio: a large-text 3:1 floor is a different bar.
      if (!seen || r.ratio - r.needs < seen.ratio - seen.needs)
        worst.set(r.label + r.where, {
          ...r,
          label: `${r.label} at ${depth}px`,
        })
    }
  }
  return [...worst.values()]
}

/* Runs in the page: every visible run of text under `root`, with the ink it is
   set in and the boxes its glyphs occupy. Only direct text nodes, so a parent
   is not credited with the ink of the children it wraps. */
function collectTargets({
  root,
  exempt,
}: {
  root: string
  exempt: string
}): Target[] {
  /* `rgb(…)` carries three numbers and `rgba(…)` four, so the alpha is read
     off the length rather than assumed. */
  const parse = (color: string): Rgba => {
    const parts = color.match(/[\d.]+/g)!.map(Number)
    const [r, g, b] = parts
    return [r, g, b, parts.length > 3 ? parts[3] : 1]
  }
  const clip = (r: DOMRect) => ({
    x: Math.max(r.left, 0),
    y: Math.max(r.top, 0),
    w: Math.min(r.right, innerWidth) - Math.max(r.left, 0),
    h: Math.min(r.bottom, innerHeight) - Math.max(r.top, 0),
  })

  const scope = document.querySelector(root)
  if (!scope) throw new Error(`${root} is not on the page`)

  const targets: Target[] = []
  for (const el of [
    scope as HTMLElement,
    ...scope.querySelectorAll<HTMLElement>('*'),
  ]) {
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue
    if (exempt && el.closest(exempt)) continue
    /* Screen-reader-only copy is clipped to a pixel and painted nowhere, and
       WCAG asks nothing of what is not rendered — but a Range still reports the
       full untruncated width of the text inside it, so it has to be dropped
       here or it arrives looking like a run that failed to paint. */
    const own = el.getBoundingClientRect()
    if (own.width <= 1 || own.height <= 1) continue

    const runs: DOMRect[] = []
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim())
        continue
      const range = document.createRange()
      range.selectNode(node)
      runs.push(...range.getClientRects())
    }
    /* An icon is ink too — but only the ones actually drawn in `currentColor`.
       An SVG with its own fills does not answer the probe at all, so it would
       come back painting nothing rather than come back measured. */
    if (
      el instanceof SVGElement &&
      el.tagName === 'svg' &&
      el.querySelector('[fill="currentColor"], [stroke="currentColor"]')
    )
      runs.push(el.getBoundingClientRect())

    const rects = runs
      .map(clip)
      /* Inset, so a glyph box that ends on a hairline does not sample it. */
      .map((r) => ({ x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }))
      .filter((r) => r.w >= 1 && r.h >= 1)
    if (!rects.length) continue

    const size = parseFloat(style.fontSize)
    const weight = Number(style.fontWeight)
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    /* An icon is a graphical object under 1.4.11, which asks 3:1 — not the
       4.5:1 its pixel height would imply if it were read as type. */
    const icon = el instanceof SVGElement
    targets.push({
      /* An icon has neither text nor a label of its own, so it borrows the
         control's — otherwise every icon on the page answers to "". */
      label: (
        el.getAttribute('aria-label') ??
        (el.textContent ||
          el.closest('[aria-label]')?.getAttribute('aria-label')) ??
        el.tagName.toLowerCase()
      )
        .trim()
        .slice(0, 40),
      where: (el.tagName.toLowerCase() + ' ' + (el.getAttribute('class') ?? ''))
        .trim()
        .replace(/\s+/g, '.')
        .slice(0, 70),
      /* SVG type is painted with `fill`, and `color` on such an element is
         whatever it happened to inherit — a different colour entirely. */
      ink: parse(
        el instanceof SVGElement && /^(text|tspan)$/.test(el.tagName)
          ? style.fill
          : style.color,
      ),
      needs: large || icon ? 3 : 4.5,
      font: `${size}px/${weight}`,
      rects,
    })
  }
  return targets
}

/* Runs in the page: Chromium decodes its own screenshots, so the pixels are
   read without a decoder in the harness. Among the pixels a glyph actually
   paints, the worst one is the reading — one thin band of pane showing through
   is enough to fail a reader. Among the ones it doesn't, nothing is: that is
   the difference between measuring the type and measuring the picture it
   happens to be laid over. */
async function sampleBackdrops({
  targets,
  shots,
  steady,
  box,
}: {
  targets: Target[]
  shots: Record<'blank' | 'black' | 'white', string>
  steady: string
  box: { x: number; y: number; width: number; height: number }
}): Promise<InkReading[]> {
  const load = async (encoded: string) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }
  const blank = await load(shots.blank)
  const black = await load(shots.black)
  const white = await load(shots.white)
  const again = await load(steady)
  const width = blank.width
  /* The shots are of the clip, not the viewport, so a glyph's page coordinates
     have to come back to the crop's own origin before they index a pixel. */
  const dpr = width / box.width

  const held = (i: number) =>
    blank.data[i] === again.data[i] &&
    blank.data[i + 1] === again.data[i + 1] &&
    blank.data[i + 2] === again.data[i + 2]

  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const luminance = ([r, g, b]: number[]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const hex = (c: number[]) =>
    '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

  /* Forced black against forced white is the widest a pixel can be moved, so
     the gap between them is the glyph's coverage there and nothing else — it
     says how much type is painted, never how light the type is. Which is why
     an unpainted run cannot hide a real failure here: ink that anyone can see
     is ink that covers something. */
  const cover = (i: number) =>
    (white.data[i] -
      black.data[i] +
      (white.data[i + 1] - black.data[i + 1]) +
      (white.data[i + 2] - black.data[i + 2])) /
    765

  /* A glyph is read at its core, where it paints solid, so that is where the
     ratio is taken — and a run that paints solid nowhere is one nobody is
     reading at full strength: type under the floating nav, the consent banner,
     a pinned ledger head. Measuring it anyway is what reports full-strength
     white failing at 3.66:1 on a pane it is merely sliding beneath. Those are
     left unmeasured and said so, rather than guessed at; every size the site
     sets, down to 11px, reaches a solid pixel when nothing is on top of it. */
  const SOLID = 0.9

  return targets.map((t) => {
    const [ir, ig, ib, ia] = t.ink
    const sweep = (visit: (i: number) => void) => {
      for (const rect of t.rects) {
        const left = rect.x - box.x
        const top = rect.y - box.y
        const x1 = Math.ceil((left + rect.w) * dpr)
        const y1 = Math.ceil((top + rect.h) * dpr)
        for (let y = Math.floor(top * dpr); y < y1; y++)
          for (let x = Math.floor(left * dpr); x < x1; x++)
            visit((y * width + x) * 4)
      }
    }

    let coverage = 0
    sweep((i) => {
      if (!held(i)) return
      const c = cover(i)
      if (c > coverage) coverage = c
    })

    let worst = { ratio: Infinity, ink: '', backdrop: '' }
    if (coverage >= SOLID) {
      sweep((i) => {
        if (!held(i) || cover(i) < SOLID) return
        const bg = [blank.data[i], blank.data[i + 1], blank.data[i + 2]]
        const over = [ir, ig, ib].map((c, k) => c * ia + bg[k] * (1 - ia))
        const ratio = contrast(over, bg)
        if (ratio < worst.ratio)
          worst = { ratio, ink: hex(over), backdrop: hex(bg) }
      })
    }
    return {
      label: t.label,
      where: t.where,
      needs: t.needs,
      font: t.font,
      coverage,
      ...worst,
    }
  })
}
