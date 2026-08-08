import type { Page } from '@playwright/test'

/** One run of amber, named by what it says. */
export interface AmberMoment {
  where: string
  says: string
}

/** The One Amber Rule counts *moments*, not nodes: colour inherits, so a run of
    amber ink is the element that starts it. Material is not ink, so the glow
    behind `aria-hidden` glass is not one.

    A tripwire for a page you already know, not an enforcement of the rule: it
    reads `color` and `background-color` against the two accent tokens, so a
    border, an SVG fill, a pseudo-element or an alpha-modified accent all pass
    it, and anything `aria-hidden` is trusted to be material. */
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
