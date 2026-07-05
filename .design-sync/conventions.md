# WT Records — build conventions

**WT Records is a public world-record registry for War Thunder** ("most kills in a single life, per vehicle, per mode"). The design system is "The Trophy Hall": a dark-first, instrument-precise look built on ultra-clear liquid glass over a night scene, with one warm accent. Read `guidelines/DESIGN.md` (visual law: colors, named rules, materials) and `guidelines/PRODUCT.md` (voice: authoritative · precise · celebratory) before composing pages.

## Setup — two things every page needs

1. **Wrap the app in `PreviewProvider`** (a bundle export). Most components (`LeaderboardList`, `RecordMonument`, `TopRecords`, `LatestRecord`, `RecordName`, `SiteNav`, `Podium`, `LatestFeed`, `WeekMarquee`, `VehicleLink`, `FallenRecords`, `LongestStanding`, `NationCompletion`, `RecordHistory`) render internal links and **crash with a router-context error without it**:

```jsx
const { PreviewProvider, SiteNav, RecordMonument } = window.WTRecords
<PreviewProvider>
  {/* your page */}
</PreviewProvider>
```

2. **Theme**: Night Hangar (dark) is the default — the stylesheet's base layer already sets `background: var(--base)` and near-white ink on `<body>`. For the light "Daylight Hall" theme set `data-theme="light"` on the root `<html>` element. Never mix: one page, one lighting state (the *Same Hall* rule).

## Styling idiom

Tailwind utilities + semantic token utilities, plus a small set of real component classes for the glass materials. **The stylesheet ships a compiled subset of Tailwind** — common layout/spacing/typography utilities and everything listed below resolve; for anything exotic (odd arbitrary values), use inline styles instead of inventing class names.

- **Semantic color utilities**: `bg-base`, `text-fg`, `text-fg-muted`, `text-fg-faint`, `text-accent-text` (amber, AA-safe on both themes), `bg-accent` (amber fill — pair with `text-black`), `border-hairline`, `border-hairline-soft`, `bg-tint`, `bg-tint-strong`, `text-gold` / `text-silver` / `text-bronze` (rank metals only — the *Earned Metal* rule: metals mark ranked standing, never decoration).
- **Glass materials** (component classes, not utilities): `glass-thin` (nav/strips) · `glass-mid` (list panes, cards) · `glass-thick` (hero panels). Add `pane-lift` for hover rise on interactive panes. `glass-pill` is the pill-nav material. Glass panes float over the page surface — never nest glass inside glass.
- **Radii**: controls `rounded-[4px]`, cards `rounded-[22px]`, panels `rounded-[26px]`, pills `rounded-full`.
- **Type**: system stack, tabular numerals are automatic. Big record numerals use `font-bold` + `text-accent-text` with tight tracking; labels use small uppercase tracked text (`text-[0.6875rem] tracking-[0.08em] uppercase text-fg-muted`).
- **One Amber**: a single amber focal moment per view. Secondary numbers stay `text-fg`.

## Where the truth lives

- `styles.css` → imports `_ds_bundle.css` (all tokens + component classes; the `:root` block is the Night token set, `:root[data-theme='light']` the day overrides).
- `guidelines/DESIGN.md` — the full spec (color ramps, elevation, do's/don'ts). `guidelines/PRODUCT.md` — voice + a11y (WCAG 2.1 AA; alt text leads factual, humor after).
- Per-component API + usage: each `components/general/<Name>/<Name>.prompt.md` and `.d.ts`.

## Idiomatic page snippet

```jsx
const { PreviewProvider, SceneBackdrop, SiteNav, RecordMonument, LeaderboardList } = window.WTRecords

<PreviewProvider>
  <SceneBackdrop />
  <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24">
    <SiteNav modes={[{ mode: 'grb', name: 'Ground RB', isLive: true }]} />
    <section className="glass-thick mt-6 p-8">
      <RecordMonument mode="grb" record={topRecord} eligibleVehicles={2145} />
    </section>
    <div className="glass-mid mt-10 overflow-hidden">
      <LeaderboardList rows={leaders} medals />
    </div>
  </div>
</PreviewProvider>
```

Content voice: records are *held*, *verified*, *chased*; vehicles that left the game show their `RemovedTag` but always count (never filter them). Player-facing numbers are facts — no rounding-up flourish.
