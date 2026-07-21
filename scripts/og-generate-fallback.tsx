import { writeFileSync } from 'node:fs'
import { renderCardPng } from '#/og/render/renderer'
import { SiteCard } from '#/og/render/card-element'

/* Regenerates the committed static site card (src/og/assets/fallback.png) from
   the same SiteCard template the /og routes serve. Committed on purpose: the
   failure path must never depend on the renderer working — a build-time render
   could break in the same upgrade that broke rendering. Re-run on an intentional
   design change: `bun run og:fallback`. */
const png = await renderCardPng(<SiteCard />)
// Two copies of the same bytes: the bundled one the failure path reads, and the
// public one the site-wide og:image points at (served statically, so a render
// outage never touches a static page's unfurl).
for (const rel of [
  '../src/og/assets/fallback.png',
  '../public/og-default.png',
]) {
  const target = new URL(rel, import.meta.url)
  writeFileSync(target, png)
  console.log(`wrote ${target.pathname}`)
}
