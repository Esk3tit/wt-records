import { describe, expect, it } from 'vitest'
import type { SheetRow } from '#/migration/sheets'
import { parseNationTab } from '#/migration/sheets'

const cell = (
  value: string | null = null,
  hyperlink: string | null = null,
) => ({
  value,
  hyperlink,
})

const HEADER: SheetRow = [
  cell('Kills'),
  cell('Tank'),
  cell('Player'),
  cell('BR'),
  cell('Patch Version'),
  cell('Screenshot'),
  cell('Screenshot 2'),
  cell('Video'),
]

describe('parseNationTab', () => {
  it('parses rows with proof hyperlinks', () => {
    const grid: Array<SheetRow> = [
      HEADER,
      [
        cell('20'),
        cell('M1A2 SEPv3'),
        cell('_LOPE_'),
        cell('12.7'),
        cell('2.57'),
        cell('1', 'https://imgur.com/a/u1TwBBf'),
        cell('2', 'https://imgur.com/a/khpPXkp'),
        cell('Video', 'https://youtu.be/eS5CRwrQKjo?si=x&t=391'),
      ],
    ]
    const { rows, problems } = parseNationTab('USA', 'usa', grid)
    expect(problems).toEqual([])
    expect(rows).toEqual([
      {
        tab: 'USA',
        nation: 'usa',
        rowNumber: 2,
        kills: 20,
        vehicleName: 'M1A2 SEPv3',
        playerName: '_LOPE_',
        br: 12.7,
        patch: '2.57',
        proofs: [
          { column: 'screenshot', url: 'https://imgur.com/a/u1TwBBf' },
          { column: 'screenshot2', url: 'https://imgur.com/a/khpPXkp' },
          { column: 'video', url: 'https://youtu.be/eS5CRwrQKjo?si=x&t=391' },
        ],
      },
    ])
  })

  it('skips blank rows and keeps short rows without proofs', () => {
    const grid: Array<SheetRow> = [
      HEADER,
      [cell(), cell(), cell()],
      [
        cell('6'),
        cell('NASAMS 3'),
        cell('Mouzeeee'),
        cell('12.7'),
        cell('2.55'),
      ],
    ]
    const { rows, problems } = parseNationTab('USA', 'usa', grid)
    expect(problems).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].proofs).toEqual([])
  })

  it('accepts a bare URL typed as cell text', () => {
    const grid: Array<SheetRow> = [
      HEADER,
      [
        cell('12'),
        cell('T-34'),
        cell('someone'),
        cell('5.7'),
        cell('2.33'),
        cell('https://imgur.com/a/abc1234'),
      ],
    ]
    const { rows, problems } = parseNationTab('USSR', 'ussr', grid)
    expect(problems).toEqual([])
    expect(rows[0].proofs).toEqual([
      { column: 'screenshot', url: 'https://imgur.com/a/abc1234' },
    ])
  })

  it('reports structural problems instead of silently dropping data', () => {
    const grid: Array<SheetRow> = [
      [cell('Wrong')],
      [cell('x'), cell('T-34'), cell('someone'), cell('5.7'), cell('2.33')],
      [cell('12'), cell(), cell('someone'), cell('5.7'), cell('2.33')],
      [
        cell('12'),
        cell('T-34'),
        cell('someone'),
        cell('5.7'),
        cell('2.33'),
        cell('1'),
      ],
    ]
    const { rows, problems } = parseNationTab('USSR', 'ussr', grid)
    expect(rows).toHaveLength(1)
    expect(problems).toEqual([
      expect.stringContaining('header column 1'),
      expect.stringContaining('header column 2'),
      expect.stringContaining('header column 3'),
      expect.stringContaining('header column 4'),
      expect.stringContaining('header column 5'),
      expect.stringContaining('header column 6'),
      expect.stringContaining('header column 7'),
      expect.stringContaining('header column 8'),
      expect.stringContaining('row 2: kills "x" is not a positive integer'),
      expect.stringContaining('row 3: missing tank'),
      expect.stringContaining(
        'row 4: screenshot cell has text "1" but no link',
      ),
    ])
  })
})
