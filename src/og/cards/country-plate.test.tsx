import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CountryPlate } from './primitives'

/* DESIGN.md's share-card floor: no informational text below ~26px at 1200×630
   (~9.4px at Discord's 432px render), and informational ink ≥0.7 alpha. The
   country's name is informational, so the floor is what sets its type size —
   asserted here rather than left to whoever next nudges the pill. */

const CARD_TYPE_FLOOR = 26
const INFORMATIONAL_INK_FLOOR = 0.7

function markup(code: string) {
  return renderToStaticMarkup(<CountryPlate code={code} />)
}

describe('CountryPlate', () => {
  it("sets the country's name above the card's legibility floor", () => {
    const size = Number(markup('JP').match(/font-size:(\d+(?:\.\d+)?)px/)?.[1])
    expect(size).toBeGreaterThanOrEqual(CARD_TYPE_FLOOR)
  })

  it('sets it in ink no fainter than informational text may be', () => {
    // The label's own colour, not the brightest alpha anywhere in the plate:
    // the fill and the edges carry their own, and neither is the text.
    const label = markup('JP').match(
      /color:rgba\(255,255,255,([\d.]+)\)[^"]*"[^>]*>Japan/,
    )
    expect(label, 'the label carries an explicit ink').not.toBeNull()
    expect(Number(label![1])).toBeGreaterThanOrEqual(INFORMATIONAL_INK_FLOOR)
  })

  it('labels the mark with the full name, never the code alone', () => {
    // The label is the whole separation from the mark-only nation chips, and a
    // card has no hover to recover it from.
    expect(markup('JP')).toContain('Japan')
    expect(markup('DE')).toContain('Germany')
  })

  it('draws the flag from an inlined data URI, never a URL', () => {
    const html = markup('JP')
    expect(html).toMatch(/src="data:image\/svg\+xml;base64,/)
    expect(html).not.toMatch(/src="https?:/)
  })

  it('renders nothing for a code the list no longer offers', () => {
    expect(markup('ZZ')).toBe('')
  })
})
