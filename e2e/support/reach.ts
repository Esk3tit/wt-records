import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** 44px is WCAG 2.5.5 Target Size (Enhanced) — level AAA, and what Apple's HIG
    asks for. PRODUCT.md names phones at the hangar screen as a real scene, so
    the controls a reader works there hold themselves to that. */
export const FLOOR = 44

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
      it. Only surfaces that overlay their neighbours need one; a reach that
      hangs into a margin steals nothing. */
  pane?: string
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
      const holder = q.pane ? document.querySelector(q.pane) : null
      if (q.pane && !holder) throw new Error(`${q.pane} never rendered`)
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
        /* Ownership runs contiguously out from the ink, so where it stops can
           be bisected rather than walked. Reaching past the widest control
           means an arm measures the true edge, not the bound. */
        const arm = (dx: number, dy: number) => {
          let held = 0
          let lost = floor * 2
          if (owns(cx + dx * lost, cy + dy * lost)) return lost
          for (let i = 0; i < 10; i++) {
            const mid = (held + lost) / 2
            if (owns(cx + dx * mid, cy + dy * mid)) held = mid
            else lost = mid
          }
          return held
        }

        const left = arm(-1, 0)
        const right = arm(1, 0)
        const up = arm(0, -1)
        const down = arm(0, 1)
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
        /* Walks the ink's own perimeter, a pixel inside it, so a neighbour
           overlapping any edge or corner shows up rather than only one that
           takes the middle. Stepped in by the corner radius where the corners
           are: a rounded control does not own the square its box reports, and
           probing the literal corner would fail every chip on the page. */
        const r =
          Math.min(
            parseFloat(getComputedStyle(el).borderRadius) || 0,
            ink.width / 2 - 1,
            ink.height / 2 - 1,
          ) + 1
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
    { floor: FLOOR, root, controls, pane },
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
    if (c.reach.w < FLOOR || c.reach.h < FLOOR)
      return [`${at} is under ${FLOOR}`]
    if (!c.square) return [`${at} reaches in a cross, not a square`]
    if (!c.inkHeld) return [`${at} has its own ink taken by a neighbour`]
    if (!c.inPane) return [`${at} reaches outside the pane`]
    return []
  })
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
