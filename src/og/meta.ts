import { absoluteUrl } from '#/lib/canonical'
import { SITE_DESCRIPTION, SITE_TITLE } from './copy'

// The <head> meta contract for a share-card page. TanStack dedupes by
// name/property with the leaf winning, so a page's tags override the root's.
const THEME_COLOR = '#F0B94A' // Medal Amber — the Discord embed accent stripe.

export interface CardMetaInput {
  title: string
  description: string
  image: string
}

export function cardMeta({ title, description, image }: CardMetaInput) {
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: image },
    { name: 'theme-color', content: THEME_COLOR },
  ]
}

// The site-wide default card — a committed PNG served from public/, so a render
// outage never affects a static page's unfurl.
export const DEFAULT_CARD_URL = absoluteUrl('/og-default.png')

export function siteMeta() {
  return cardMeta({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    image: DEFAULT_CARD_URL,
  })
}
