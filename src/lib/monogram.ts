/** Up-to-two-letter initials for the Medallion: first letters of the first two
    words, or the first two letters of a single word. Script-agnostic (Cyrillic
    IGNs are common); "?" only when there's nothing to read. */
export function monogram(name: string): string {
  const words = name
    .trim()
    .split(/[\s_.-]+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1)
    return [...words[0]].slice(0, 2).join('').toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
