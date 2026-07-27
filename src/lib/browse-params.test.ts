import { describe, expect, it } from 'vitest'
import {
  browseFilters,
  nextSortSearch,
  normalizeBrowseSearch,
} from '#/lib/browse-params'

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

  it('canonicalizes bare numerics the router JSON-parses (?rank=4 → 4)', () => {
    expect(normalizeBrowseSearch({ rank: 4, q: 88 })).toEqual({
      rank: '4',
      q: '88',
    })
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

describe('nextSortSearch', () => {
  it('sorts ascending on the first press of an idle column', () => {
    expect(nextSortSearch({}, 'kills')).toEqual({ sort: 'kills' })
  })

  it('reverses to descending on the second press', () => {
    expect(nextSortSearch({ sort: 'kills' }, 'kills')).toEqual({
      sort: 'kills',
      dir: 'desc',
    })
  })

  it('returns to the default order on the third', () => {
    expect(nextSortSearch({ sort: 'kills', dir: 'desc' }, 'kills')).toEqual({})
  })

  it('starts a different column ascending, dropping the old direction', () => {
    expect(nextSortSearch({ sort: 'kills', dir: 'desc' }, 'br')).toEqual({
      sort: 'br',
    })
  })

  it('restarts paging, since row one is no longer the same row', () => {
    expect(nextSortSearch({ page: 4 }, 'name')).toEqual({ sort: 'name' })
  })

  it('leaves the filters alone — order is not a filter', () => {
    expect(nextSortSearch({ nation: 'france', q: 'tiger' }, 'br')).toEqual({
      nation: 'france',
      q: 'tiger',
      sort: 'br',
    })
  })
})
