import sairaUri from '../assets/fonts/Saira.ttf?inline'
import golosUri from '../assets/fonts/GolosText.ttf?inline'

/* Self-hosted OFL faces for the renderer. Imported with Vite's `?inline`, which
   bakes the bytes into the bundle as a base64 data-URI — a plain `readFileSync`
   of the .ttf survives dev but the server bundler drops the file, so the read
   throws in production. Pinned variable TTFs registered at fixed weights: the
   renderer instances each weight from the one file, so output is deterministic
   without a file per weight. Server-only. */

function decodeDataUri(uri: string): Uint8Array {
  return new Uint8Array(Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64'))
}

const saira = decodeDataUri(sairaUri)
const golos = decodeDataUri(golosUri)

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
