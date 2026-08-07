import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3210/prototype/profile-v2'
const OUT = '.proto-shots'
mkdirSync(OUT, { recursive: true })

const shots: Array<{ q: string; theme: 'dark' | 'light'; w: number; h: number; name: string }> = [
  { q: 'd=d&c=full&m=24&w=1', theme: 'dark', w: 1280, h: 1000, name: 'd-full-m24-wash-dark-1280' },
  { q: 'd=d&c=full&m=24&w=0', theme: 'dark', w: 1280, h: 1000, name: 'd-full-m24-nowash-dark-1280' },
  { q: 'd=d&c=full&m=24&w=1', theme: 'light', w: 1280, h: 1000, name: 'd-full-m24-wash-light-1280' },
  { q: 'd=d&c=full&m=24&w=0', theme: 'light', w: 1280, h: 1000, name: 'd-full-m24-nowash-light-1280' },
  { q: 'd=d&c=empty&m=24&w=0', theme: 'dark', w: 1280, h: 1000, name: 'd-empty-m24-nowash-dark-1280' },
  { q: 'd=d&c=norecords&m=24&w=0', theme: 'dark', w: 1280, h: 1000, name: 'd-norecords-m24-nowash-dark-1280' },
  { q: 'd=d&c=owner&m=24&w=0', theme: 'dark', w: 1280, h: 1000, name: 'd-owner-m24-nowash-dark-1280' },
  { q: 'd=d&c=pending&m=24&w=0', theme: 'dark', w: 1280, h: 1000, name: 'd-pending-m24-nowash-dark-1280' },
  { q: 'd=d&c=full&m=24&w=0', theme: 'dark', w: 320, h: 900, name: 'd-full-m24-nowash-dark-320' },
  { q: 'd=c&c=full&m=24', theme: 'dark', w: 1280, h: 1000, name: 'c-full-m24-dark-1280-cmp' },
]

const browser = await chromium.launch()
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  await ctx.addInitScript(`try{localStorage.setItem('theme','${s.theme}')}catch(e){}`)
  const page = await ctx.newPage()
  await page.goto(`${BASE}?${s.q}`, { waitUntil: 'load' })
  await page.waitForSelector('h1')
  await page.getByRole('button', { name: /decline/i }).click({ timeout: 2000 }).catch(() => undefined)
  await page.waitForTimeout(1400)
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: s.w === 320 })
  console.log(s.name)
  await ctx.close()
}
await browser.close()
