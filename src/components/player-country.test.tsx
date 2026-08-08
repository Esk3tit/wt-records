import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PlayerCountry } from './player-country'
import { resolveCountryMark } from '#/lib/country-mark-server'

const japan = resolveCountryMark('JP')!

describe('PlayerCountry', () => {
  it('never shows the mark without the country name beside it', () => {
    const { container } = render(<PlayerCountry country={japan} />)
    expect(container.textContent).toBe('Japan')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  // Windows renders the regional-indicator letters, which is how this slips
  // past dev testing on a Mac.
  it('draws the flag, never an emoji', () => {
    const { container } = render(<PlayerCountry country={japan} />)
    expect(container.textContent).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u)
    expect(container.querySelector('svg')!.children.length).toBeGreaterThan(0)
  })

  it('hides the mark from assistive tech, since the name is already the label', () => {
    const svg = render(
      <PlayerCountry country={japan} />,
    ).container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(svg.querySelector('title')).toBeNull()
  })

  it('links nowhere', () => {
    const { container } = render(<PlayerCountry country={japan} />)
    expect(container.querySelector('a')).toBeNull()
  })
})

describe('resolveCountryMark', () => {
  it('resolves a stored code to a mark and its full name', () => {
    expect(resolveCountryMark('JP')).toMatchObject({
      code: 'JP',
      name: 'Japan',
    })
  })

  it('renders nothing for no country, and for a code no longer offered', () => {
    expect(resolveCountryMark(null)).toBeNull()
    expect(resolveCountryMark('')).toBeNull()
    expect(resolveCountryMark('ZZ')).toBeNull()
    expect(resolveCountryMark('jp')).toBeNull()
  })
})
