import { describe, expect, it } from 'vitest'
import { COUNTRY_PLATE_HEIGHT } from './primitives'
import {
  CAPTION_MARGIN_TOP,
  IDENTITY_MAX_HEIGHT,
  NAME_GAP,
  NAME_MAX_HEIGHT,
  NAME_TWO_LINES,
} from './player-card'

/* The identity column clips, so what it clips has to land between elements and
   never through one. These are the boundaries that decide it — arithmetic,
   because in a render it shows up as a row of glyph tops or a capsule sheared
   flat, and only a reader would ever notice. */

/** Name, then the gap a wrapped country plate takes, then the plate. */
const WRAPPED_STACK = NAME_MAX_HEIGHT + NAME_GAP + COUNTRY_PLATE_HEIGHT

describe('the identity column ceiling', () => {
  it('leaves a wrapped country plate room to draw whole', () => {
    // The failure this exists to catch: a name filling its own clamp pushed the
    // plate past the ceiling and it rendered sheared.
    expect(WRAPPED_STACK).toBeLessThanOrEqual(IDENTITY_MAX_HEIGHT)
  })

  it('stops before the caption that would follow it can put ink down', () => {
    /* Whole or absent — a caption that half-fits is the worse outcome. It
       starts at its own margin below the plate, so the ceiling has to fall at
       or before that, not merely before the caption's far edge. */
    expect(IDENTITY_MAX_HEIGHT).toBeLessThanOrEqual(
      WRAPPED_STACK + CAPTION_MARGIN_TOP,
    )
  })

  it('clamps the name to two whole lines, with no room for a third', () => {
    // Rounding up covers the line; more than a rounding's worth of slack is
    // what lets the top of a third line through.
    expect(NAME_MAX_HEIGHT).toBeGreaterThanOrEqual(NAME_TWO_LINES)
    expect(NAME_MAX_HEIGHT - NAME_TWO_LINES).toBeLessThan(1)
  })
})
