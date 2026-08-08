import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** 44px is WCAG 2.5.5 Target Size (Enhanced) — level AAA, and what Apple's HIG
    asks for. PRODUCT.md names phones at the hangar screen as a real scene, so
    the controls a reader works there hold themselves to that. */
export const REACH_FLOOR = 44

/** Turns the containment check off, for a region with nothing close enough to
    lose ink to an overhang. Spelled out rather than left off, so a call site
    cannot weaken the proof by forgetting a field. */
export const UNBOUNDED = 'unbounded'

/** Anything a thumb is meant to land on. Hidden inputs and the search field's
    own clear affordance are not separate controls. */
const CONTROLS = 'a, button, select, input:not([type="hidden"])'

export interface Reach {
  label: string
  ink: string
  reach: { w: number; h: number }
  square: boolean
  inkHeld: boolean
  inPane: boolean
}

export interface ReachQuery {
  /** The region whose controls are measured. */
  root: string
  /** Narrows which of them count; defaults to every tappable element. */
  controls?: string
  /** The box no reach may escape, because something else owns the pixels past
      it, or `UNBOUNDED`. */
  pane: string | typeof UNBOUNDED
}

/** Asks the page who would receive a tap at each point around a control, and
    reports the box it actually owns. Measuring the reach beats probing a square
    centred on the ink: a target is no less reachable for sitting off-centre. */
export async function reachOf(
  page: Page,
  { root, controls = CONTROLS, pane }: ReachQuery,
): Promise<Reach[]> {
  const found = await page.evaluate(
    (q) => {
      const region = document.querySelector(q.root)
      if (!region) throw new Error(`${q.root} never rendered`)
      const holder =
        q.pane === q.unbounded ? null : document.querySelector(q.pane)
      if (q.pane !== q.unbounded && !holder)
        throw new Error(`${q.pane} never rendered`)
      const bounds = holder?.getBoundingClientRect()
      const floor = q.floor

      const labelOf = (el: HTMLElement) => {
        const aria = el.getAttribute('aria-label')
        if (aria) return aria
        // A select's textContent is every option it holds, so it is read off
        // its <label> instead — the only name a reader ever sees.
        const named = el as HTMLElement & { labels?: NodeListOf<HTMLElement> }
        const own = named.labels?.length
          ? named.labels[0].textContent
          : el.textContent
        return (own || el.getAttribute('placeholder') || el.id).trim()
      }

      const shown = [
        ...region.querySelectorAll<HTMLElement>(q.controls),
      ].filter(
        // A control the layout has not rendered — folded behind a disclosure,
        // or a column this width drops — is not a target to measure.
        (el) => el.getClientRects().length > 0,
      )

      return shown.map((el) => {
        const ink = el.getBoundingClientRect()
        const cx = ink.left + ink.width / 2
        const cy = ink.top + ink.height / 2
        const owns = (x: number, y: number) => {
          const hit = document.elementFromPoint(x, y)
          return !!hit && (hit === el || el.contains(hit))
        }
        /* How far an arm must look to prove a reach has not escaped its pane: a
           pane edge further out than the arm bothers to probe would report
           every reach as contained, however far past it they actually run. Two
           past the edge, not one, because one is the slack `inPane` allows —
           an arm that stopped there could never report an escape. */
        const escape = bounds
          ? {
              left: cx - bounds.left + 2,
              right: bounds.right - cx + 2,
              up: cy - bounds.top + 2,
              down: bounds.bottom - cy + 2,
            }
          : { left: 0, right: 0, up: 0, down: 0 }

        /* Ownership runs contiguously out from the ink, so where it stops can
           be bisected rather than walked. Bisecting to a fixed precision rather
           than a fixed count keeps a long look from coarsening the answer. */
        const arm = (dx: number, dy: number, reach: number) => {
          let held = 0
          let lost = Math.max(floor * 2, reach)
          if (owns(cx + dx * lost, cy + dy * lost)) return lost
          for (let i = 0; i < 24 && lost - held > 0.05; i++) {
            const mid = (held + lost) / 2
            if (owns(cx + dx * mid, cy + dy * mid)) held = mid
            else lost = mid
          }
          return held
        }

        const left = arm(-1, 0, escape.left)
        const right = arm(1, 0, escape.right)
        const up = arm(0, -1, escape.up)
        const down = arm(0, 1, escape.down)
        /* The arms only prove a cross. Slide the widest square they allow into
           that cross and check its corners, so an L-shaped reach cannot pass. */
        const x0 = Math.min(
          Math.max(cx - left, cx - floor / 2),
          cx + right - floor,
        )
        const y0 = Math.min(
          Math.max(cy - up, cy - floor / 2),
          cy + down - floor,
        )
        const square = [
          [x0, y0],
          [x0 + floor, y0],
          [x0, y0 + floor],
          [x0 + floor, y0 + floor],
        ].every(([x, y]) => owns(x, y))
        /* Walks the ink's own perimeter a pixel inside it, so a neighbour
           overlapping any edge shows up and not only one taking the middle.
           Stepped in by the radius at the corners: a rounded control does not
           own the square its box reports. Read per corner, since the shorthand
           reports only the first and a control rounded at its other end would
           be probed square. */
        const edges = getComputedStyle(el)
        const corner = Math.max(
          parseFloat(edges.borderTopLeftRadius) || 0,
          parseFloat(edges.borderTopRightRadius) || 0,
          parseFloat(edges.borderBottomRightRadius) || 0,
          parseFloat(edges.borderBottomLeftRadius) || 0,
        )
        const r = Math.min(corner, ink.width / 2 - 1, ink.height / 2 - 1) + 1
        const xs = [ink.left + r, cx, ink.right - r]
        const ys = [ink.top + r, cy, ink.bottom - r]
        const inkHeld = [
          ...xs.map((x) => [x, ink.top + 1]),
          ...xs.map((x) => [x, ink.bottom - 1]),
          ...ys.map((y) => [ink.left + 1, y]),
          ...ys.map((y) => [ink.right - 1, y]),
        ].every(([x, y]) => owns(x, y))

        /* A reach that hangs outside the pane would take taps meant for the
           content beside or under it — the risk a reach carries once it stops
           being centred. Slack of a pixel, because hit testing snaps to the
           device grid and the arms are measured, not read off the box. */
        const inPane =
          !bounds ||
          (cy - up >= bounds.top - 1 &&
            cy + down <= bounds.bottom + 1 &&
            cx - left >= bounds.left - 1 &&
            cx + right <= bounds.right + 1)

        return {
          label: labelOf(el),
          ink: `${ink.width.toFixed(1)}x${ink.height.toFixed(1)}`,
          reach: { w: left + right, h: up + down },
          square,
          inkHeld,
          inPane,
        }
      })
    },
    { floor: REACH_FLOOR, unbounded: UNBOUNDED, root, controls, pane },
  )

  expect(found.length, `${root} had no controls to measure`).toBeGreaterThan(0)
  return found
}

/** One line per control that a thumb cannot land on cleanly. Empty is the pass. */
export async function reachFaults(
  page: Page,
  query: ReachQuery,
): Promise<string[]> {
  return (await reachOf(page, query)).flatMap((c) => {
    const at = `${c.label} (ink ${c.ink}, reach ${c.reach.w.toFixed(1)}x${c.reach.h.toFixed(1)})`
    if (c.reach.w < REACH_FLOOR || c.reach.h < REACH_FLOOR)
      return [`${at} is under ${REACH_FLOOR}`]
    if (!c.square) return [`${at} reaches in a cross, not a square`]
    if (!c.inkHeld) return [`${at} has its own ink taken by a neighbour`]
    if (!c.inPane) return [`${at} reaches outside the pane`]
    return []
  })
}

/** Every character of prose a control's reach would answer for. A reach grows
    into what the layout left empty, and `reachFaults` only notices when what it
    took belonged to another control — so text one line-height below a control
    is taken silently, and a tap on a word fires something. One line per theft;
    empty is the pass. */
export async function proseTaken(
  page: Page,
  { root, controls = CONTROLS }: Pick<ReachQuery, 'root' | 'controls'>,
): Promise<string[]> {
  return page.evaluate(
    (q) => {
      const region = document.querySelector(q.root)
      if (!region) throw new Error(`${q.root} never rendered`)
      const isControl = (node: Node | null) =>
        node instanceof Element ? node.closest(q.controls) : null

      const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      const taken = new Map<string, string>()
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? ''
        // Text inside a control is its own label, not prose beside it.
        if (!text.trim() || isControl(node.parentElement)) continue
        for (let i = 0; i < text.length; i++) {
          range.setStart(node, i)
          range.setEnd(node, i + 1)
          const box = range.getBoundingClientRect()
          if (!box.width) continue
          const thief = isControl(
            document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2,
            ),
          )
          if (!thief) continue
          // One line per (thief, prose) pair: a reach that took one character
          // took a run of them, and listing each says nothing more.
          const label = (thief.textContent || '').trim().slice(0, 30)
          taken.set(
            `${label}|${text.trim()}`,
            `${label} answers for "${text.trim().slice(0, 40)}"`,
          )
          break
        }
      }
      return [...taken.values()]
    },
    { root, controls },
  )
}

/** Taps the far corner of the box a control owns. elementFromPoint says who
    owns a pixel; only a real click proves the widened reach carries the
    control's own behaviour with it. The arm is measured off the reach rather
    than off the ink, so on an axis the reach had to widen the tap lands outside
    the ink — and on an axis it did not, it still lands at the ink's own edge. */
export async function tapFarEdge(page: Page, control: Locator) {
  const box = await control.boundingBox()
  expect(box, 'the control never rendered').not.toBeNull()
  const arm = (side: number) => Math.max(side, REACH_FLOOR) / 2 - 0.5
  await page.mouse.click(
    box!.x + box!.width / 2 - arm(box!.width),
    box!.y + box!.height / 2 - arm(box!.height),
  )
}

/** Brings a region fully on screen, because a control scrolled past the edge is
    owned by nobody: hit testing only answers for the visible viewport. Asserted
    and re-asserted, because the router restores its own scroll position a beat
    after hydration and undoes the first attempt. */
export async function bringIntoView(page: Page, selector: string) {
  const region = page.locator(selector).first()
  const onScreen = () =>
    region.evaluate((el) => {
      const box = el.getBoundingClientRect()
      return box.top >= 0 && box.bottom <= window.innerHeight
    })
  for (let attempt = 0; attempt < 10; attempt++) {
    if (await onScreen()) return
    await region.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(150)
  }
  throw new Error(`${selector} would not stay on screen`)
}

/** The height a region occupies, so a reach can be proven to cost no layout. */
export async function heightOf(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => el.getBoundingClientRect().height)
}

/** Re-measures with the reach withdrawn, so the region is compared against
    itself rather than against a number that rots the next time it is tuned. */
export async function heightWithoutReach(
  page: Page,
  selector: string,
): Promise<number> {
  await page.addStyleTag({ content: '.tap-reach::after { display: none }' })
  return heightOf(page, selector)
}
