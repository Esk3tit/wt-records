import { describe, expect, it } from 'vitest'
import { monogram } from '#/lib/monogram'

describe('monogram', () => {
  it('takes the first letter of the first two words', () => {
    expect(monogram('Ace Of Spades')).toBe('AO')
    expect(monogram('john doe')).toBe('JD')
  })

  it('takes two letters from a single word, splitting IGN separators', () => {
    expect(monogram('Floppa')).toBe('FL')
    expect(monogram('x')).toBe('X')
    expect(monogram('Ace_TV')).toBe('AT')
    expect(monogram('big.red')).toBe('BR')
  })

  it('is script-agnostic and falls back to ? on nothing', () => {
    expect(monogram(' Игрок')).toBe('ИГ')
    expect(monogram('   ')).toBe('?')
  })
})
