/** BRs always render with one decimal ("10.0", "3.7"), matching the game. */
export function formatBr(br: number): string {
  return br.toFixed(1)
}

const RANK_ROMANS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
]

/** Ranks render as roman numerals ("Rank IV"), matching the game tree. */
export function formatRank(rank: number): string {
  return RANK_ROMANS[rank - 1] ?? String(rank)
}
