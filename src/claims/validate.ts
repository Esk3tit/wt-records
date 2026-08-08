import { MAX_NOTE_LENGTH } from '#/claims/limits'
import { normalizeCountryCode } from '#/lib/countries'

/* Runtime validation for the claim server-fn boundary: the public claim
   endpoints take untrusted network payloads, so ids and notes are checked
   here rather than trusting the compile-time types. */

export function positiveInt(value: unknown, field: string): number {
  // isSafeInteger, not isInteger: values past 2^53 collapse in JSON transport.
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`)
  }
  return value
}

/** Null clears it; anything else must be on the selectable list, so codes that
    merely ship in the flag package can't be stored. The one place one enters. */
export function selectableCountryCode(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error('A country must be a code')
  const code = normalizeCountryCode(value)
  if (!code) throw new Error('Choose a country from the list')
  return code
}

export function optionalNote(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string') throw new Error('A note must be text')
  if (value.length > MAX_NOTE_LENGTH) {
    throw new Error(`Keep the note to at most ${MAX_NOTE_LENGTH} characters`)
  }
  return value
}
