// Search-term generation for vehicle name matching. One implementation
// serves every surface: catalog sync and seed write terms through
// nameSearchTerms(); query paths normalize input through searchKey().
// SQL only ever compares precomputed terms.

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10 }

// Canonical roman numerals 1–30 only ([ivx], subtractive forms). The cap
// excludes ambiguous single letters like the C in "Kfir C.7" (100) or the
// D in "P-51D" (500), which are designations, not numerals.
const ROMAN_RE = /^x{0,3}(?:ix|iv|v?i{0,3})$/

function romanToArabic(token: string): number | null {
  if (token.length === 0 || !ROMAN_RE.test(token)) return null
  let value = 0
  for (let i = 0; i < token.length; i++) {
    const digit = ROMAN_VALUES[token[i]]
    const next = i + 1 < token.length ? ROMAN_VALUES[token[i + 1]] : 0
    value += digit < next ? -digit : digit
  }
  return value >= 1 && value <= 30 ? value : null
}

const ROMAN_UNITS = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix']

function arabicToRoman(token: string): string | null {
  if (!/^[1-9][0-9]?$/.test(token)) return null
  const value = Number(token)
  if (value > 30) return null
  return 'x'.repeat(Math.floor(value / 10)) + ROMAN_UNITS[value % 10]
}

function foldDiacritics(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Collapse text to its bare-alphanumeric matching key: NFKD, diacritics
 * stripped, lowercased, everything outside [a-z0-9] dropped — so `t34`,
 * `t-34`, and `t 34` are the same key and tree-marker glyphs vanish. */
export function searchKey(input: string): string {
  return foldDiacritics(input).replace(/[^a-z0-9]+/g, '')
}

const MAX_TERMS = 16

/** All matchable terms for a vehicle name: its search key plus the cross
 * product of roman⇄arabic numeral token variants (Tiger II ⇄ tiger 2).
 * Wrong expansions are additive only — an extra low-ranked match, never a
 * missed one. */
export function nameSearchTerms(name: string): string[] {
  const tokens = foldDiacritics(name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)

  let terms = ['']
  for (const token of tokens) {
    const variants = [token]
    const arabic = romanToArabic(token)
    if (arabic !== null) variants.push(String(arabic))
    const roman = arabicToRoman(token)
    if (roman !== null) variants.push(roman)
    terms = terms
      .flatMap((prefix) => variants.map((v) => prefix + v))
      .slice(0, MAX_TERMS)
  }
  return [...new Set(terms.filter((t) => t.length > 0))]
}
