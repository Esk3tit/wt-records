import { describe, expect, it } from 'vitest'
import { ADMIN_PAGE_SIZE, pageParam } from '#/components/admin/pager'

describe('pageParam', () => {
  it('keeps a real page and drops everything that is not one', () => {
    expect(pageParam('3')).toBe(3)
    expect(pageParam(1)).toBeUndefined()
    expect(pageParam(0)).toBeUndefined()
    expect(pageParam(-2)).toBeUndefined()
    expect(pageParam('two')).toBeUndefined()
    expect(pageParam(2.5)).toBeUndefined()
    expect(pageParam(undefined)).toBeUndefined()
  })

  it('clamps a page whose offset would leave safe-integer range', () => {
    const clamped = pageParam(Number.MAX_SAFE_INTEGER + 1)!
    expect(Number.isSafeInteger((clamped - 1) * ADMIN_PAGE_SIZE)).toBe(true)
  })
})
