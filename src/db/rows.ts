// The schema runs without noUncheckedIndexedAccess, so a destructured first row
// is typed as always-present; this makes "row might be missing" explicit.
export function one<T>(rows: T[]): T | null {
  return rows.length > 0 ? rows[0] : null
}
