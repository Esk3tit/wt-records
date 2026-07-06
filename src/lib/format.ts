/** BRs always render with one decimal ("10.0", "3.7"), matching the game. */
export function formatBr(br: number): string {
  return br.toFixed(1)
}
