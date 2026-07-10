import { describe, expect, it } from 'vitest'
import { mergeFeedRows } from './live-feed-rows'
import type { FeedRow } from './live-feed-rows'

interface Entry {
  id: number
  label?: string
}

const settled = (...ids: number[]): FeedRow<Entry>[] =>
  ids.map((id) => ({ entry: { id }, phase: 'settled' }))

describe('mergeFeedRows', () => {
  it('keeps rows settled and takes the fresh entry data when ids are unchanged', () => {
    const next = [
      { id: 1, label: 'fresh' },
      { id: 2, label: 'fresh' },
    ]
    const rows = mergeFeedRows(settled(1, 2), next)
    expect(rows).toEqual([
      { entry: { id: 1, label: 'fresh' }, phase: 'settled' },
      { entry: { id: 2, label: 'fresh' }, phase: 'settled' },
    ])
  })

  it('returns prev unchanged when the same settled entries come back', () => {
    const entries = [{ id: 1 }, { id: 2 }]
    const prev: FeedRow<Entry>[] = entries.map((entry) => ({
      entry,
      phase: 'settled',
    }))
    expect(mergeFeedRows(prev, entries)).toBe(prev)
  })

  it('appends new ids at the bottom as entering, in feed order', () => {
    const rows = mergeFeedRows(settled(1, 2), [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ])
    expect(rows.map((r) => [r.entry.id, r.phase])).toEqual([
      [1, 'settled'],
      [2, 'settled'],
      [3, 'entering'],
      [4, 'entering'],
    ])
  })

  it('holds dropped ids in place as exiting', () => {
    const rows = mergeFeedRows(settled(1, 2, 3), [{ id: 2 }, { id: 3 }])
    expect(rows.map((r) => [r.entry.id, r.phase])).toEqual([
      [1, 'exiting'],
      [2, 'settled'],
      [3, 'settled'],
    ])
  })

  it('a record landing while another falls off produces one entering and one exiting row', () => {
    const rows = mergeFeedRows(settled(1, 2, 3), [
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ])
    expect(rows.map((r) => [r.entry.id, r.phase])).toEqual([
      [1, 'exiting'],
      [2, 'settled'],
      [3, 'settled'],
      [4, 'entering'],
    ])
  })

  it('keeps an in-flight entering row entering and revives an exiting one that reappears', () => {
    const prev: FeedRow<Entry>[] = [
      { entry: { id: 1 }, phase: 'exiting' },
      { entry: { id: 2 }, phase: 'settled' },
      { entry: { id: 3 }, phase: 'entering' },
    ]
    const rows = mergeFeedRows(prev, [{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(rows.map((r) => [r.entry.id, r.phase])).toEqual([
      [1, 'settled'],
      [2, 'settled'],
      [3, 'entering'],
    ])
  })

  it('treats an older record surfacing mid-list as backfill, not an arrival', () => {
    // A displayed record vanished server-side; an older one re-enters the
    // window from below and must slot into chronological place quietly.
    const rows = mergeFeedRows(settled(3, 4, 5), [
      { id: 2 },
      { id: 3 },
      { id: 5 },
    ])
    expect(rows.map((r) => [r.entry.id, r.phase])).toEqual([
      [2, 'settled'],
      [3, 'settled'],
      [4, 'exiting'],
      [5, 'settled'],
    ])
  })

  it('renders a wholesale replacement settled, with no arrival fanfare', () => {
    const rows = mergeFeedRows(settled(1, 2), [{ id: 8 }, { id: 9 }])
    expect(rows.map((r) => [r.entry.id, r.phase])).toEqual([
      [1, 'exiting'],
      [2, 'exiting'],
      [8, 'settled'],
      [9, 'settled'],
    ])
  })
})
