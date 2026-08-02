import type { Page } from '@playwright/test'
import { deepestScroll, readerScrollsTo } from './nav'

/** What a piece of ink measured against the surface it actually sits on. */
export interface InkReading {
  label: string
  /** Enough of the element to go and find it — a label alone repeats. */
  where: string
  /** The sweep's named surfaces this run sits inside. */
  inside: string[]
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
  /** Compounded ancestor opacity: what the ink actually renders at. */
  dim: number
  /** The sweep's named surfaces this run sits inside. */
  inside: string[]
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
  /** Selectors for the surfaces this sweep is accountable for; each reading
      records which it sits inside, so `unmeasured` can prove they were read. */
  sites: string[] = [],
  again = false,
): Promise<InkReading[]> {
  await probe(page, root, 'ink')
  await quiesced(page)
  const targets = await page.evaluate(collectTargets, { root, exempt, sites })
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

  const readings = await page.evaluate(sampleBackdrops, {
    targets,
    shots,
    steady,
    box,
  })

  /* Dropping unstable pixels is right per pixel and wrong per page: under a
     loaded machine the art is still arriving and nearly every pixel disagrees,
     which would return a full set of readings that measured nothing at all.
     One retry, then say so — a sweep that quietly measures nothing is the one
     failure this whole harness exists to not have.

     Nothing at all, rather than some fraction: a run left unmeasured because
     the nav is over it is doing exactly what it should, and at a depth where a
     lot of copy sits under the pane those legitimate skips would otherwise read
     as a page that never settled. */
  if (readings.some((r) => isFinite(r.ratio))) return readings
  if (again) throw new Error(`${root} would not hold still long enough to read`)
  return readInk(page, root, exempt, sites, true)
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

    /* The corner has to be showing the stack for the pixel read off it to mean
       anything: covered by a pane, it differs from the flood whatever the scrim
       does, and the check below would pass without ever being able to fail. */
    const top = document.elementFromPoint(2, 2)
    if (top?.closest('header, main, footer'))
      throw new Error('the corner the flood is read from is covered')

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
  /* Decoding is repeated rather than shared with `sampleBackdrops`: both halves
     run inside the page, where an evaluate cannot close over module scope. */
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
  return sites.filter((s) => !took.some((r) => r.inside.includes(s)))
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
    sites = [],
  }: {
    root?: string
    exempt?: string
    depths: number[]
    settle?: () => Promise<void>
    sites?: string[]
  },
): Promise<InkReading[]> {
  /* Floored at zero: a page that fits the viewport reports a negative scroll
     range, and asking the reader to reach it never succeeds. */
  const floor = Math.max(await deepestScroll(page), 0)
  /* The floor itself, always: a page whose scroll ends between two configured
     depths would otherwise never have its last screen read, and the bottom of
     a ledger is where the rows this guard is for actually are. */
  const stops = [...new Set([...depths.filter((d) => d <= floor), floor])].sort(
    (a, b) => a - b,
  )
  const worst = new Map<string, InkReading>()
  for (const depth of stops) {
    await readerScrollsTo(page, depth)
    await settle?.()
    for (const r of await readInk(page, root, exempt, sites)) {
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
  sites,
}: {
  root: string
  exempt: string
  sites: string[]
}): Target[] {
  /* `rgb(…)` carries three numbers and `rgba(…)` four, so the alpha is read
     off the length rather than assumed. */
  /* `none`, a gradient `url(#id)`, a bare keyword: an SVG paint is not always
     a colour, and a run painted with one carries no ratio to take. */
  const parse = (color: string): Rgba | null => {
    const parts = color.match(/[\d.]+/g)?.map(Number)
    if (!parts || parts.length < 3) return null
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
    if (style.visibility === 'hidden') continue
    if (exempt && el.closest(exempt)) continue
    /* 1.4.3 and 1.4.11 ask nothing of an inactive component, which is why a
       pager's spent arrow is allowed to go faint. Measuring them anyway turns
       every disabled control on the site into a failure nobody can act on. */
    if (
      el.closest(
        ':disabled, fieldset:disabled *, [aria-disabled="true"], [aria-disabled="true"] *',
      )
    )
      continue
    /* Opacity compounds down the tree, and a run dimmed by a wrapper is still a
       run someone has to read. Left out, it would paint below solid everywhere
       and be dropped as occluded — the one way real ink could go unmeasured
       while the suite stayed green. Carried instead, so the ratio is taken
       against the strength the ink actually renders at. */
    let dim = 1
    for (let n: Element | null = el; n; n = n.parentElement)
      dim *= Number(getComputedStyle(n).opacity)
    if (dim === 0) continue
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
      /* A Range reports the text's full laid-out width, which for a truncated
         cell runs past the clip and over its neighbour — where it would claim
         that neighbour's solid pixels for this ink. Held to the element's own
         box, which is what the overflow actually shows. */
      .map((r) => {
        const x = Math.max(r.x, own.left)
        const y = Math.max(r.y, own.top)
        return {
          x,
          y,
          w: Math.min(r.x + r.w, own.right) - x,
          h: Math.min(r.y + r.h, own.bottom) - y,
        }
      })
      /* Inset, so a glyph box that ends on a hairline does not sample it. */
      .map((r) => ({ x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }))
      .filter((r) => r.w >= 1 && r.h >= 1)
    if (!rects.length) continue

    const size = parseFloat(style.fontSize)
    const weight = Number(style.fontWeight)
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    /* An icon is a graphical object under 1.4.11, which asks 3:1 — not the
       4.5:1 its pixel height would imply if it were read as type. SVG *type*
       is type: a monogram is read, not looked at. */
    const icon = el instanceof SVGElement && el.tagName === 'svg'
    /* SVG type is painted with `fill`, and `color` on such an element is
       whatever it happened to inherit — a different colour entirely. */
    const paint = parse(
      el instanceof SVGElement && /^(text|tspan)$/.test(el.tagName)
        ? style.fill
        : style.color,
    )
    if (!paint) continue

    targets.push({
      dim,
      /* Which of the surfaces this sweep is accountable for the run sits in.
         Answered with the DOM rather than by matching class strings, so a site
         means the component it names and not any element that happens to share
         a utility class with it. */
      inside: sites.filter((s) => el.closest(s)),
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
      ink: paint,
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
  const height = blank.height
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
    const [ir, ig, ib, a] = t.ink
    /* A dimmed run paints its own geometry at `dim` strength, so the coverage
       read back is scaled by it and the ink lands that much weaker. Divide the
       one out to recover the glyph, multiply the other in to keep the ratio
       honest — at dim 1, both are no-ops. */
    const ia = a * t.dim
    /* Held to the decoded image: the clip is rounded to whole CSS pixels and
       scaled by a device ratio, so a rect's last column can land a pixel past
       the bitmap — where the index quietly wraps onto the next row and reads a
       neighbour's colour as this glyph's backdrop. */
    const sweep = (visit: (i: number) => void) => {
      for (const rect of t.rects) {
        const left = rect.x - box.x
        const top = rect.y - box.y
        const x1 = Math.min(Math.ceil((left + rect.w) * dpr), width)
        const y1 = Math.min(Math.ceil((top + rect.h) * dpr), height)
        for (let y = Math.max(Math.floor(top * dpr), 0); y < y1; y++)
          for (let x = Math.max(Math.floor(left * dpr), 0); x < x1; x++)
            visit((y * width + x) * 4)
      }
    }

    let coverage = 0
    sweep((i) => {
      if (!held(i)) return
      const c = cover(i) / t.dim
      if (c > coverage) coverage = c
    })

    let worst = { ratio: Infinity, ink: '', backdrop: '' }
    if (coverage >= SOLID) {
      sweep((i) => {
        if (!held(i) || cover(i) / t.dim < SOLID) return
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
      inside: t.inside,
      needs: t.needs,
      font: t.font,
      coverage,
      ...worst,
    }
  })
}
