import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { NationFlag, NationFlagSprite, NATION_FLAG_SLUGS } from './nation-flag'
import { CANONICAL_NATIONS } from '#/catalog/mapping'

const NATION_SLUGS = CANONICAL_NATIONS.map((n) => n.slug)

describe('NationFlag', () => {
  it('has art for every canonical nation', () => {
    expect([...NATION_FLAG_SLUGS].sort()).toEqual([...NATION_SLUGS].sort())
  })

  it('renders an instance as a <use> reference on the in-game canvas', () => {
    const svg = render(<NationFlag slug="usa" />).container.querySelector(
      'svg',
    )!
    expect(svg.getAttribute('viewBox')).toBe('0 16 100 68')
    const use = svg.querySelector('use')!
    expect(use.getAttribute('href')).toBe('#flag-usa')
    expect(svg.querySelectorAll('rect, path, circle')).toHaveLength(0)
  })

  it.each(['atlantis', 'toString', 'constructor'])(
    'renders nothing for an unknown nation (%s)',
    (slug) => {
      const { container } = render(<NationFlag slug={slug} />)
      expect(container.innerHTML).toBe('')
    },
  )

  it('is decorative: hidden from the accessibility tree', () => {
    const { container } = render(<NationFlag slug="japan" />)
    expect(container.querySelector('span')!.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('keeps chips whole and lets washes crop', () => {
    const chip = render(<NationFlag slug="usa" />).container.querySelector(
      'svg',
    )!
    expect(chip.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
    const wash = render(
      <NationFlag slug="usa" variant="wash" />,
    ).container.querySelector('svg')!
    expect(wash.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice')
  })
})

describe('NationFlagSprite', () => {
  const sprite = () => render(<NationFlagSprite />).container

  it('is invisible and hidden from the accessibility tree', () => {
    const svg = sprite().querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('width')).toBe('0')
    expect(svg.getAttribute('height')).toBe('0')
  })

  it('defines each nation exactly once under its instance-referenced id', () => {
    const ids = [...sprite().querySelectorAll('[id]')].map((el) => el.id)
    expect([...ids].sort()).toEqual(NATION_SLUGS.map((s) => `flag-${s}`).sort())
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(NATION_SLUGS)('%s art is self-contained vendored shapes', (slug) => {
    const group = sprite().querySelector(`#flag-${slug}`)!
    // stylesheet classes and nested ids would collide across flags; every
    // shape must carry its own valid hex fill
    expect(group.querySelectorAll('[id], [class], style, defs')).toHaveLength(0)
    const shapes = group.querySelectorAll('rect, path, circle')
    expect(shapes.length).toBeGreaterThan(0)
    for (const shape of shapes) {
      expect(shape.getAttribute('fill')).toMatch(
        /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
      )
    }
    // a field rect must span the full canvas height or washes show a
    // transparent sliver at their edges
    const fullHeight = [...group.querySelectorAll('rect')].some(
      (r) =>
        Number(r.getAttribute('y')) === 16 &&
        Number(r.getAttribute('height')) === 68,
    )
    expect(fullHeight, `${slug} field must span the viewBox height`).toBe(true)
  })
})
