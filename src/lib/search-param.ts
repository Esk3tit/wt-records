/** The router JSON-parses bare search values, so "4" arrives as the number 4
 * and "true" as a boolean; canonicalize scalars back to the string form the
 * validators expect before type checks. */
export function asParam(value: unknown): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  return value
}
