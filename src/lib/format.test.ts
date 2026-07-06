import { describe, expect, it } from 'vitest'
import { formatBr } from '#/lib/format'

describe('formatBr', () => {
  it('always shows one decimal, like the game does', () => {
    expect(formatBr(10)).toBe('10.0')
    expect(formatBr(3.7)).toBe('3.7')
    expect(formatBr(1)).toBe('1.0')
  })
})
