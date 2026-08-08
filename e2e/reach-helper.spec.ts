import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { proseTaken, reachFaults } from './support/reach'

/* The suite's touch-target specs are only as honest as the helper measuring
   them, and a measurement that quietly answers "fine" is worse than none. So
   the helper is held to cases built here rather than found in the app: static
   markup, no server, and each one a fault it once failed to see. */

const PANE = { root: '#pane', pane: '#pane' }

/** A 44px control sitting 400px inside a 500px pane. `reach` widens its
    pseudo-element the way `.tap-reach` does; `bare` takes it away, which is the
    only way the control's own corners are what a tap lands on. */
async function render(
  page: Page,
  {
    style = '',
    reach = '44px',
    size = '44px; height: 44px',
  }: { style?: string; reach?: string; size?: string } = {},
) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.setContent(`<!doctype html><style>
    body { margin: 0 }
    #pane { position: absolute; left: 100px; top: 100px; width: 500px; height: 200px }
    #ctl { position: absolute; left: 78px; top: 78px; width: ${size} }
    #ctl::after { content: ${reach === 'bare' ? 'none' : "''"}; position: absolute;
      top: 50%; left: 50%; translate: -50% -50%; width: ${reach}; height: 44px }
  </style>
  <div id="pane"><button id="ctl" style="${style}">ok</button></div>`)
}

/* The pane's far edge is further out than an arm that stops at twice the floor
   will ever look, so a reach running past it was reported as contained. */
test('a reach escaping a distant pane edge is caught', async ({ page }) => {
  await render(page)
  expect(await reachFaults(page, PANE), 'a contained reach passes').toEqual([])

  await render(page, { reach: '1000px' })

  expect(await reachFaults(page, PANE)).toEqual([
    expect.stringContaining('reaches outside the pane'),
  ])
})

/* `borderRadius` reports only the first of the four corners, so a control
   rounded anywhere else was probed at a literal corner it does not own and
   reported as having had its ink stolen. Bare, because a reach laid over the
   control covers those corners squarely and hides the question; and roomier
   than a thumb, so the square check clears the curve and only the perimeter
   walk is under test. */
test('a control rounded on one corner is not read as stolen', async ({
  page,
}) => {
  await render(page, {
    style: 'border-radius: 0 0 20px 0',
    reach: 'bare',
    size: '80px; height: 60px',
  })

  expect(await reachFaults(page, PANE)).toEqual([])
})

/** A sentence with a link in it, in a column narrow enough that the rest of the
    sentence wraps to the line below — where a reach widened to a thumb reaches.
    `grown` is what `.tap-reach` does to it. */
async function renderProse(page: Page, { grown }: { grown: boolean }) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.setContent(`<!doctype html><style>
    body { margin: 0; font: 14px/20px sans-serif }
    #pane { position: absolute; left: 100px; top: 100px; width: 170px }
    a { position: relative }
    ${grown ? "a::after { content: ''; position: absolute; top: 50%; left: 50%; translate: -50% -50%; width: max(100%, 44px); height: max(100%, 44px) }" : ''}
  </style>
  <div id="pane"><p><a href="#">Strv 122B PLSS</a> · GRB · ended May 2024</p></div>`)
}

/* A reach only grows into what the layout left empty, and `reachFaults` speaks
   only for controls — so a link widened inside a sentence took the rest of that
   sentence silently, and a tap on a word navigated. */
test('a reach that answers for the prose beside it is caught', async ({
  page,
}) => {
  await renderProse(page, { grown: false })
  expect(
    await proseTaken(page, PANE),
    'an inline link at its own size takes nothing',
  ).toEqual([])

  await renderProse(page, { grown: true })

  expect(await proseTaken(page, PANE)).toEqual([
    expect.stringContaining('· GRB · ended May 2024'),
  ])
})
