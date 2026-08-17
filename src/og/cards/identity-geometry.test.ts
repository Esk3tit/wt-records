import { describe, expect, it } from 'vitest'
import { COUNTRY_PLATE_HEIGHT } from './primitives'
import { IDENTITY_MAX_HEIGHT, NAME_GAP, NAME_MAX_HEIGHT } from './player-card'

/* The identity column clips, so what it clips has to land between elements and
   never through one. These are the two boundaries that decide it — arithmetic,
   because by the time it shows up in a render it is a row of glyph tops or a
   capsule sheared flat, and only a reader would notice. */

describe('the identity column ceiling', () => {
  it('leaves a wrapped country plate room to draw whole', () => {
    // The failure this exists to catch: a name long enough to fill its own
    // clamp pushed the plate across the ceiling and it rendered sheared.
    expect(
      NAME_MAX_HEIGHT + NAME_GAP + COUNTRY_PLATE_HEIGHT,
    ).toBeLessThanOrEqual(IDENTITY_MAX_HEIGHT)
  })

  it('leaves the caption that follows a wrapped plate no room at all', () => {
    // Whole or absent: a caption that half-fits is the worse outcome, so the
    // ceiling must fall at or before where one would start.
    expect(
      NAME_MAX_HEIGHT + NAME_GAP + COUNTRY_PLATE_HEIGHT,
    ).toBeGreaterThanOrEqual(IDENTITY_MAX_HEIGHT - NAME_GAP)
  })

  it('clamps the name to whole lines', () => {
    expect(NAME_MAX_HEIGHT).toBe(Math.ceil(NAME_MAX_HEIGHT))
  })
})
