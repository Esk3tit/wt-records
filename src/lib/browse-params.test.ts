import { describe, expect, it } from 'vitest'
import { browseFilters, normalizeBrowseSearch } from '#/lib/browse-params'

describe('normalizeBrowseSearch', () => {
  it('keeps well-formed values in canonical string form', () => {
    expect(
      normalizeBrowseSearch({
        q: ' tiger ',
        nation: 'germany,ussr',
        class: 'heavy,medium',
        rank: '3,4',
        br: '5.3-6.7',
        acq: 'premium,removed',
        status: 'open',
        sort: 'br',
        dir: 'desc',
        page: 2,
      }),
    ).toEqual({
      q: 'tiger',
      nation: 'germany,ussr',
      class: 'heavy,medium',
      rank: '3,4',
      br: '5.3-6.7',
      acq: 'premium,removed',
      status: 'open',
      sort: 'br',
      dir: 'desc',
      page: 2,
    })
  })

  it('returns an empty object for an unfiltered URL', () => {
    expect(normalizeBrowseSearch({})).toEqual({})
  })

  it('omits defaults (page 1, dir asc)', () => {
    expect(normalizeBrowseSearch({ page: 1, dir: 'asc' })).toEqual({})
  })

  it('drops garbage values instead of erroring', () => {
    expect(
      normalizeBrowseSearch({
        q: '   ',
        nation: 'GERMANY!,<script>',
        class: 'tank,heavy',
        rank: 'x,0,3',
        br: 'high',
        acq: 'free',
        status: 'won',
        sort: 'coolness',
        page: 'two',
      }),
    ).toEqual({ class: 'heavy', rank: '3' })
  })

  it('swaps reversed BR bounds', () => {
    expect(normalizeBrowseSearch({ br: '6.7-5.3' })).toEqual({ br: '5.3-6.7' })
  })

  it('dedupes CSV values', () => {
    expect(normalizeBrowseSearch({ nation: 'ussr,ussr' })).toEqual({
      nation: 'ussr',
    })
  })

  it('can omit facets a route does not mount', () => {
    expect(
      normalizeBrowseSearch({ q: 'tiger', nation: 'germany', class: 'heavy' }, [
        'q',
        'nation',
      ]),
    ).toEqual({ class: 'heavy' })
  })
})

describe('browseFilters', () => {
  it('parses the canonical strings into typed filters', () => {
    expect(
      browseFilters({
        q: 'tiger',
        nation: 'germany,ussr',
        rank: '3,4',
        br: '5.3-6.7',
        acq: 'tech-tree',
        status: 'open',
      }),
    ).toEqual({
      q: 'tiger',
      nations: ['germany', 'ussr'],
      classes: [],
      ranks: [3, 4],
      br: { min: 5.3, max: 6.7 },
      acq: ['tech-tree'],
      status: 'open',
      sort: null,
      dir: 'asc',
      page: 1,
    })
  })
})
