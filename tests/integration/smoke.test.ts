import { describe, expect, it } from 'vitest'
import { slugify } from '#/lib/slug'

// Proves the node integration project boots and resolves the `#/` alias.
// PR2 fills this directory with PGlite tests that replay committed migrations.
describe('integration project (node environment)', () => {
  it('runs in a node environment', () => {
    expect(typeof process.versions.node).toBe('string')
  })

  it('resolves the # path alias from node tests', () => {
    expect(slugify('USSR')).toBe('ussr')
  })
})
