import type { Page } from '@playwright/test'

export type Lighting = 'dark' | 'light'

/** The hall is worn both ways and its two fills are separate rules, so a
    measurement that only ever sees one of them proves half of what it claims. */
export const LIGHTING = ['dark', 'light'] as const satisfies Lighting[]

/** Stamped before navigation, because the theme decides which fill the page is
    painted with on its very first frame. */
export async function stampTheme(page: Page, theme: Lighting) {
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
}
