/** Up-to-two-letter initials for the Medallion: first letters of the first two
    words, or the first two letters of a single word. Script-agnostic (Cyrillic
    IGNs are common); "?" only when there's nothing to read. */
export function monogram(name: string): string {
  // Punctuation is stripped from the edges before a letter is taken: a quoted
  // nickname («Vasiliy "Grom" Antonov») would otherwise hand back a quote mark
  // as somebody's initial.
  const words = name
    .trim()
    .split(/[\s_.-]+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1)
    return [...words[0]].slice(0, 2).join('').toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
