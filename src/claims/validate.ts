import { MAX_LINK_INPUT, MAX_NOTE_LENGTH } from '#/claims/limits'
import { normalizeCountryCode } from '#/lib/countries'
import { isStorablePlatform } from '#/links/platforms'

/* Runtime validation for the claim server-fn boundary: the public claim
   endpoints take untrusted network payloads, so ids and notes are checked
   here rather than trusting the compile-time types. */

export function nonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a whole number`)
  }
  return value
}

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
  // Strict: an omitted field is a malformed payload, not an instruction to clear.
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('A country must be a code')
  const code = normalizeCountryCode(value)
  if (!code) throw new Error('Choose a country from the list')
  return code
}

/** The platform a link write names. Checked against the config here, at the
    boundary — the config is what the `platform` text column is validated
    against, and this is where an untrusted payload meets it. */
export function storablePlatform(value: unknown): string {
  if (typeof value !== 'string') throw new Error('A platform must be a name')
  if (!isStorablePlatform(value)) {
    throw new Error('That platform is not one this site links')
  }
  return value
}

/** The raw field value, bounded before any parser sees it. What it *means* is
    the platform's business — see `parseLinkValue`. */
export function linkValue(value: unknown): string {
  if (typeof value !== 'string') throw new Error('A link must be text')
  if (value.length > MAX_LINK_INPUT) {
    throw new Error('That is longer than any handle or address')
  }
  return value
}

/** A revocation's reason: the only thing that tells a mistake, a departure and
    a punishment apart afterwards, so an empty one is a malformed payload. */
export function requiredReason(value: unknown): string {
  if (typeof value !== 'string') throw new Error('A reason must be text')
  const reason = value.trim()
  if (!reason) {
    throw new Error('Record a reason — it is what tells a mistake from a ban')
  }
  if (reason.length > MAX_NOTE_LENGTH) {
    throw new Error(`Keep the reason to at most ${MAX_NOTE_LENGTH} characters`)
  }
  return reason
}

export function optionalNote(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string') throw new Error('A note must be text')
  if (value.length > MAX_NOTE_LENGTH) {
    throw new Error(`Keep the note to at most ${MAX_NOTE_LENGTH} characters`)
  }
  return value
}
