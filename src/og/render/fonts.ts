import { GOLOS_TTF, SAIRA_TTF } from '../assets/embedded'

// Self-hosted OFL faces, embedded as base64 (see scripts/og-embed-assets.ts) so
// they load in the server bundle, vitest, and bun scripts alike. Variable TTFs
// registered at fixed weights: deterministic output, no file per weight.

function decodeBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

const saira = decodeBase64(SAIRA_TTF)
const golos = decodeBase64(GOLOS_TTF)

// Saira: square HUD character — hero numerals, vehicle names, wordmark.
export const SAIRA = 'Saira'
// Golos Text: Cyrillic-native — player names, labels, chips.
export const GOLOS = 'Golos Text'

export const OG_FONTS = [
  { name: SAIRA, data: saira, weight: 600, style: 'normal' },
  { name: SAIRA, data: saira, weight: 700, style: 'normal' },
  { name: SAIRA, data: saira, weight: 800, style: 'normal' },
  { name: GOLOS, data: golos, weight: 400, style: 'normal' },
  { name: GOLOS, data: golos, weight: 500, style: 'normal' },
  { name: GOLOS, data: golos, weight: 600, style: 'normal' },
] as const
