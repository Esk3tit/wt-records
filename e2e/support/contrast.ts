import type { Page } from '@playwright/test'

/** What a piece of ink measured against the surface it actually sits on. */
export interface InkReading {
  label: string
  /** The ink's own contrast against its worst pixel of backdrop. */
  ratio: number
  /** The AA floor this size and weight has to clear: 4.5, or 3 when large. */
  needs: number
  ink: string
  backdrop: string
  font: string
}

type Rgba = [r: number, g: number, b: number, a: number]

interface Target {
  label: string
  ink: Rgba
  needs: number
  font: string
  rects: { x: number; y: number; w: number; h: number }[]
}

/** Panes here are translucent glass over a scene and the ink carries its own
    alpha, so neither side of the ratio can be read off a token. Glyphs are
    blanked before the screenshot because sampling with type still painted reads
    antialiased edges and flatters the result. */
export async function readInk(
  page: Page,
  root: string,
  /** Anything WCAG asks nothing of — a logotype under 1.4.3, say. */
  exempt: string,
): Promise<InkReading[]> {
  await probe(page, root, 'ink')
  const targets = await page.evaluate(collectTargets, { root, exempt })
  if (!targets.length) throw new Error(`no ink to measure under ${root}`)

  await probe(page, root, 'blank')
  const shot = (await page.screenshot()).toString('base64')
  await probe(page, root, 'release')

  return page.evaluate(sampleBackdrops, { targets, shot })
}

const PROBE = 'ink-probe'

/* One sheet rewritten by id, not a tag added and dropped per reading: a removal
   that had not landed yet would measure still-transparent ink as a perfect 1:1.
   Every state but `release` also freezes transitions, because the nav animates
   its colours and a faded probe gets read halfway. */
async function probe(
  page: Page,
  root: string,
  state: 'ink' | 'blank' | 'release',
) {
  await page.evaluate(
    ({ scope, id, want }) => {
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
      sheet.textContent =
        want === 'release'
          ? ''
          : want === 'ink'
            ? frozen
            : `${frozen} ${scope}, ${scope} * { color: transparent !important;
                 -webkit-text-fill-color: transparent !important; }`
    },
    { scope: root, id: PROBE, want: state },
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
        `${r.ink} on ${r.backdrop}, ${r.font}`,
    )
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

    const runs: DOMRect[] = []
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim())
        continue
      const range = document.createRange()
      range.selectNode(node)
      runs.push(...range.getClientRects())
    }
    /* An icon is ink too, and it is drawn in `currentColor` like the type. */
    if (el instanceof SVGElement && el.tagName === 'svg')
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
      ink: parse(style.color),
      needs: large ? 3 : 4.5,
      font: `${size}px/${weight}`,
      rects,
    })
  }
  return targets
}

/* Runs in the page: Chromium decodes its own screenshot, so the pixels are read
   without a decoder in the harness. Every pixel under a glyph box is a
   candidate backdrop and the worst one is the reading — one thin band of pane
   showing through is enough to fail a reader. */
async function sampleBackdrops({
  targets,
  shot,
}: {
  targets: Target[]
  shot: string
}): Promise<InkReading[]> {
  const image = new Image()
  image.src = `data:image/png;base64,${shot}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const dpr = image.naturalWidth / innerWidth
  const { data, width } = ctx.getImageData(0, 0, canvas.width, canvas.height)

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

  return targets.map((t) => {
    const [ir, ig, ib, ia] = t.ink
    let worst = { ratio: Infinity, ink: '', backdrop: '' }
    for (const rect of t.rects) {
      const x1 = Math.ceil((rect.x + rect.w) * dpr)
      const y1 = Math.ceil((rect.y + rect.h) * dpr)
      for (let y = Math.floor(rect.y * dpr); y < y1; y++) {
        for (let x = Math.floor(rect.x * dpr); x < x1; x++) {
          const i = (y * width + x) * 4
          const bg = [data[i], data[i + 1], data[i + 2]]
          const over = [ir, ig, ib].map((c, k) => c * ia + bg[k] * (1 - ia))
          const ratio = contrast(over, bg)
          if (ratio < worst.ratio)
            worst = { ratio, ink: hex(over), backdrop: hex(bg) }
        }
      }
    }
    return { label: t.label, needs: t.needs, font: t.font, ...worst }
  })
}
