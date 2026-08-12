import { describe, expect, it } from 'vitest'
import { errorMessage } from './errors'

/* What a person is shown when something failed. The rule that matters: never
   the database's own words — they reach public surfaces too, not just /admin. */

describe('errorMessage', () => {
  it('passes through what the app said on purpose', () => {
    expect(errorMessage(new Error('This player is already claimed'))).toBe(
      'This player is already claimed',
    )
  })

  it('never hands back the statement a driver failed on', () => {
    const drizzle = new Error(
      'Failed query: update "players" set "user_id" = $1, "avatar_key" = $2',
    )
    expect(errorMessage(drizzle)).toBe('Something went wrong')
    expect(errorMessage(drizzle)).not.toContain('players')
  })

  it('catches a driver error by its SQLSTATE when the message says nothing', () => {
    const violation = Object.assign(new Error('duplicate key value'), {
      code: '23505',
    })
    expect(errorMessage(violation)).toBe('Something went wrong')
  })

  it('answers a generic for anything that is not an Error', () => {
    expect(errorMessage('boom')).toBe('Something went wrong')
    expect(errorMessage(null)).toBe('Something went wrong')
  })
})
