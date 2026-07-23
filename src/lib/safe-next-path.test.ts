import { describe, expect, it } from 'vitest'
import { safeNextPath } from '#/lib/safe-next-path'

describe('safeNextPath', () => {
  it('passes a same-origin absolute path through, query and all', () => {
    expect(safeNextPath('/player/ace')).toBe('/player/ace')
    expect(safeNextPath('/player/ace?claim=1')).toBe('/player/ace?claim=1')
    expect(safeNextPath('/')).toBe('/')
  })

  it('rejects off-origin and scheme-bearing targets', () => {
    expect(safeNextPath('//evil.com')).toBe('/admin')
    expect(safeNextPath('/\\evil.com')).toBe('/admin')
    expect(safeNextPath('https://evil.com')).toBe('/admin')
    expect(safeNextPath('javascript:alert(1)')).toBe('/admin')
    expect(safeNextPath('player/ace')).toBe('/admin')
  })

  it('rejects embedded control characters (response splitting)', () => {
    expect(safeNextPath('/player/ace\r\nSet-Cookie: x=1')).toBe('/admin')
    expect(safeNextPath('/player/ace\n')).toBe('/admin')
    expect(safeNextPath('/player/\tace')).toBe('/admin')
  })

  it('rejects non-strings and honours a custom fallback', () => {
    expect(safeNextPath(undefined)).toBe('/admin')
    expect(safeNextPath(42)).toBe('/admin')
    expect(safeNextPath(null, '/')).toBe('/')
  })
})
