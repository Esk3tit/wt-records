import { MAX_NOTE_LENGTH } from '#/claims/limits'

/* Runtime validation for the claim server-fn boundary: the public claim
   endpoints take untrusted network payloads, so ids and notes are checked
   here rather than trusting the compile-time types. */

export function positiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`)
  }
  return value
}

export function optionalNote(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string') throw new Error('A note must be text')
  if (value.length > MAX_NOTE_LENGTH) {
    throw new Error(`Keep the note under ${MAX_NOTE_LENGTH} characters`)
  }
  return value
}
