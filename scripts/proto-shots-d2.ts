import { chromium } from '@playwright/test'
const BASE = 'http://localhost:3210/prototype/profile-v2'
const shots = [
  { q: 'd=d&c=full&m=24&w=0&h=days', theme: 'dark', w: 1280, h: 1000, name: 'd2-full-dark-1280' },
  { q: 'd=d&c=empty&m=24&w=0&h=days', theme: 'dark', w: 1280, h: 1000, name: 'd2-empty-dark-1280' },
  { q: 'd=d&c=norecords&m=24&w=0&h=days', theme: 'dark', w: 1280, h: 1000, name: 'd2-norecords-dark-1280' },
  { q: 'd=d&c=full&m=24&w=0&h=days', theme: 'light', w: 1280, h: 1000, name: 'd2-full-light-1280' },
  { q: 'd=d&c=full&m=24&w=0&h=days', theme: 'dark', w: 320, h: 900, name: 'd2-full-dark-320' },
] as const
const browser = await chromium.launch()
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await ctx.addInitScript(`try{localStorage.setItem('theme','${s.theme}')}catch(e){}`)
  const page = await ctx.newPage()
  await page.goto(`${BASE}?${s.q}`, { waitUntil: 'load' })
  await page.waitForSelector('h1')
  await page.getByRole('button', { name: /decline/i }).click({ timeout: 2000 }).catch(() => undefined)
  await page.waitForTimeout(1400)
  await page.screenshot({ path: `.proto-shots/${s.name}.png`, fullPage: s.w === 320 })
  console.log(s.name)
  await ctx.close()
}
await browser.close()
