import type { Page } from '@playwright/test'

/** One run of amber, named by what it says. */
export interface AmberMoment {
  where: string
  says: string
}

/** The One Amber Rule counts *moments*, not nodes. Colour inherits, so a run of
    amber ink is the element that starts it and every descendant riding on that
    inheritance belongs to the same moment. Two carve-outs the rule makes by
    name are honoured here: **material is not ink**, so the monument's glow —
    a gradient behind `aria-hidden` glass — is not counted, and **summoned ink
    spends no ration**, so the focus ring never rests in this reading. */
export async function amberMoments(
  page: Page,
  root: string,
): Promise<AmberMoment[]> {
  return page.evaluate((selector) => {
    const host = document.querySelector(selector)
    if (!host) throw new Error(`no ${selector} to read amber from`)

    // Tokens resolve per theme, so they are read off the live document rather
    // than named, and through a real element so both arrive as rgb().
    const probe = document.createElement('span')
    probe.style.display = 'none'
    host.append(probe)
    const resolve = (token: string) => {
      probe.style.color = `var(${token})`
      return getComputedStyle(probe).color
    }
    const ambers = new Set([
      resolve('--accent-text'),
      resolve('--color-accent'),
    ])
    probe.remove()

    const inkOf = (el: Element | null) => (el ? getComputedStyle(el).color : '')

    return [...host.querySelectorAll('*')]
      .filter((el) => !el.closest('[aria-hidden="true"]'))
      .filter((el) => {
        const { color, backgroundColor } = getComputedStyle(el)
        if (ambers.has(backgroundColor)) return true
        return ambers.has(color) && !ambers.has(inkOf(el.parentElement))
      })
      .map((el) => ({
        where: `${el.tagName.toLowerCase()} ${el.getAttribute('class') ?? ''}`
          .trim()
          .slice(0, 80),
        says: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
      }))
  }, root)
}
