import { createFileRoute } from '@tanstack/react-router'
import {
  DirectionA,
  DirectionB,
  DirectionC,
} from '#/prototype/header-directions'
import { DirectionD } from '#/prototype/monument-direction'
import type { Case } from '#/prototype/header-directions'

/* THROWAWAY — profile-v2 prototype (#160). Not shipped, not linked from the
   site. ?d=a|b|c &c=full|empty|owner|pending */

function avatar(a: string, b: string, initial: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><radialGradient id="g" cx="34%" cy="26%" r="86%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><rect width="240" height="240" fill="url(#g)"/><circle cx="120" cy="96" r="42" fill="rgba(0,0,0,0.22)"/><path d="M28 240c0-52 41-84 92-84s92 32 92 84z" fill="rgba(0,0,0,0.22)"/><text x="120" y="216" font-family="sans-serif" font-size="34" font-weight="700" fill="rgba(255,255,255,0.85)" text-anchor="middle">${initial}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

const APPROVED = avatar('#6b7f96', '#26303d', 'A')
const PENDING = avatar('#9c6b4a', '#3d2a1f', 'P')

const STATS = {
  nationSpread: [
    { slug: 'ussr', name: 'USSR', records: 6 },
    { slug: 'germany', name: 'Germany', records: 3 },
    { slug: 'usa', name: 'USA', records: 2 },
    { slug: 'sweden', name: 'Sweden', records: 1 },
  ],
  longestHeld: {
    vehicleSlug: 'is-2',
    vehicleName: 'IS-2',
    mode: 'grb',
    heldSeconds: 61 * 24 * 3600,
    lostAt: null,
  },
  lastVerifiedAt: '2026-07-28T00:00:00.000Z',
}

const LINKS = [
  { platform: 'youtube', handle: '@ЖелезняковRecords' },
  { platform: 'twitch', handle: 'zheleznyakov_wt' },
  { platform: 'kick', handle: 'zheleznyakov' },
  { platform: 'x', handle: '@zhelez_wt' },
  { platform: 'tiktok', handle: '@zheleznyakov.wt' },
  { platform: 'site', handle: 'zheleznyakov.gg' },
]

const RECORDS = [
  { mode: 'GRB', vehicle: 'IS-2', kills: 34 },
  { mode: 'GRB', vehicle: 'T-34-85', kills: 21 },
  { mode: 'ARB', vehicle: 'Bf 109 F-4', kills: 17 },
]
const ONE_RECORD = [{ mode: 'GRB', vehicle: 'M4A1 (76) W', kills: 9 }]

const CASES: Record<string, Case> = {
  full: {
    displayName: 'Пётр Железняков-Оболенский',
    formerNames: ['PetrZ', 'Железняков'],
    avatarUrl: APPROVED,
    isClaimed: true,
    country: { code: 'FR', name: 'France' },
    links: LINKS,
    isOwner: false,
    mark: 40,
    records: RECORDS,
    stats: STATS,
  },
  empty: {
    displayName: 'jonno',
    formerNames: [],
    avatarUrl: null,
    isClaimed: false,
    country: null,
    links: [],
    isOwner: false,
    mark: 40,
    records: ONE_RECORD,
    stats: {
      nationSpread: [{ slug: 'usa', name: 'USA', records: 1 }],
      longestHeld: {
        vehicleSlug: 'm4a1-76-w',
        vehicleName: 'M4A1 (76) W',
        mode: 'grb',
        heldSeconds: 12 * 24 * 3600,
        lostAt: null,
      },
      lastVerifiedAt: '2026-05-02T00:00:00.000Z',
    },
  },
  owner: {
    displayName: 'Пётр Железняков-Оболенский',
    formerNames: ['PetrZ', 'Железняков'],
    avatarUrl: APPROVED,
    isClaimed: true,
    country: { code: 'FR', name: 'France' },
    links: LINKS,
    isOwner: true,
    mark: 40,
    records: RECORDS,
    stats: STATS,
  },
  // The owner's pending avatar: the ONLY difference from `owner` is the image.
  // Any second difference anywhere on this page is the bug.
  pending: {
    displayName: 'Пётр Железняков-Оболенский',
    formerNames: ['PetrZ', 'Железняков'],
    avatarUrl: PENDING,
    isClaimed: true,
    country: { code: 'FR', name: 'France' },
    links: LINKS,
    isOwner: true,
    mark: 40,
    records: RECORDS,
    stats: STATS,
  },
  norecords: {
    displayName: 'Пётр Железняков-Оболенский',
    formerNames: ['PetrZ'],
    avatarUrl: APPROVED,
    isClaimed: true,
    country: { code: 'FR', name: 'France' },
    links: LINKS,
    isOwner: false,
    mark: 40,
    records: [],
    stats: { ...STATS, nationSpread: [] },
  },
  ownerbare: {
    displayName: 'jonno',
    formerNames: [],
    avatarUrl: null,
    isClaimed: true,
    country: null,
    links: [],
    isOwner: true,
    mark: 40,
    records: ONE_RECORD,
    stats: {
      nationSpread: [{ slug: 'usa', name: 'USA', records: 1 }],
      longestHeld: {
        vehicleSlug: 'm4a1-76-w',
        vehicleName: 'M4A1 (76) W',
        mode: 'grb',
        heldSeconds: 12 * 24 * 3600,
        lostAt: null,
      },
      lastVerifiedAt: '2026-05-02T00:00:00.000Z',
    },
  },
}



export const Route = createFileRoute('/prototype/profile-v2')({
  validateSearch: (s: Record<string, unknown>) => ({
    d: (s.d as string) ?? 'a',
    c: (s.c as string) ?? 'full',
    m: Number(s.m ?? 40),
    w: Number(s.w ?? 1),
    h: (s.h as string) === 'days' ? 'days' : 'titles',
  }),
  component: Prototype,
})

function Prototype() {
  const { d, c, m, w, h } = Route.useSearch()
  const base = CASES[c] ?? CASES.full
  // Kick's published 40px floor for the Special K sets the mark for the whole
  // row, or Kick does not ship. `m` is that fork.
  const kase = {
    ...base,
    mark: m,
    links: m >= 40 ? base.links : base.links.filter((l) => l.platform !== 'kick'),
  }
  return (
    <section className="mt-6 space-y-5">
      {d === 'd' ? (
        <DirectionD c={kase} wash={w === 1} hero={h} />
      ) : d === 'c' ? (
        <DirectionC c={kase} />
      ) : d === 'b' ? (
        <DirectionB c={kase} />
      ) : (
        <DirectionA c={kase} />
      )}

      <div className="glass-mid p-6 sm:p-7">
        <h2 className="section-label mb-4">Current records</h2>
        {kase.records.length === 0 && (
          <p className="text-sm text-fg-faint">No current records yet.</p>
        )}
        <ul className="space-y-0.5">
          {kase.records.map((r) => (
            <li
              key={r.vehicle}
              className="flex items-center gap-3 rounded-[10px] px-2 py-1.5"
            >
              <span className="w-11 shrink-0 text-xs font-medium tracking-wide text-fg-faint uppercase">
                {r.mode}
              </span>
              <span className="min-w-0 flex-1">{r.vehicle}</span>
              <span className="shrink-0 font-semibold text-fg">{r.kills}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
