import { describe, expect, it } from 'vitest'
import { likeContains } from '#/lib/like'

describe('likeContains', () => {
  it('wraps plain text in wildcards', () => {
    expect(likeContains('tiger')).toBe('%tiger%')
  })

  it('escapes every LIKE metacharacter', () => {
    expect(likeContains('100%')).toBe('%100\\%%')
    expect(likeContains('a_b')).toBe('%a\\_b%')
    expect(likeContains('a\\b')).toBe('%a\\\\b%')
  })

  it('handles a mixed string', () => {
    expect(likeContains('_50%\\x_')).toBe('%\\_50\\%\\\\x\\_%')
  })
})
