import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

/* THROWAWAY — profile-v2 prototype (#160). Captures every direction × case. */

const BASE = 'http://localhost:3210/prototype/profile-v2'
const OUT = '.proto-shots'
mkdirSync(OUT, { recursive: true })

const shots: Array<{
  d: string
  c: string
  m: number
  theme: 'dark' | 'light'
  w: number
  h: number
}> = []

for (const d of ['a', 'b', 'c']) {
  for (const c of ['full', 'empty', 'owner', 'pending', 'ownerbare']) {
    shots.push({ d, c, m: 40, theme: 'dark', w: 1280, h: 1000 })
  }
  shots.push({ d, c: 'full', m: 24, theme: 'dark', w: 1280, h: 1000 })
  shots.push({ d, c: 'full', m: 40, theme: 'light', w: 1280, h: 1000 })
  shots.push({ d, c: 'full', m: 24, theme: 'light', w: 1280, h: 1000 })
  shots.push({ d, c: 'full', m: 40, theme: 'dark', w: 320, h: 900 })
  shots.push({ d, c: 'full', m: 24, theme: 'dark', w: 320, h: 900 })
  shots.push({ d, c: 'owner', m: 40, theme: 'dark', w: 320, h: 900 })
}

const browser = await chromium.launch()
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  await ctx.addInitScript(`try{
    localStorage.setItem('theme','${s.theme}');
    localStorage.setItem('wtr.consent', JSON.stringify({analytics:false,at:Date.now()}));
    localStorage.setItem('consent', 'declined');
  }catch(e){}`)
  const page = await ctx.newPage()
  await page.goto(`${BASE}?d=${s.d}&c=${s.c}&m=${s.m}`, { waitUntil: 'load' })
  await page.waitForSelector('h1')
  // The consent banner overlays the foot of every capture.
  await page
    .getByRole('button', { name: /decline/i })
    .click({ timeout: 2000 })
    .catch(() => undefined)
  await page.waitForTimeout(1000)
  const name = `${s.d}-${s.c}-m${s.m}-${s.theme}-${s.w}`
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: s.w === 320 })
  console.log(name)
  await ctx.close()
}
await browser.close()
