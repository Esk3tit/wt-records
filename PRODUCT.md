# Product

## Register

product

## Users

The War Thunder records community: players chasing single-life kill records (grinders hunting open bounties), moderators verifying submissions, and visitors checking who holds a title. Gamers on desktop in dark rooms first, but phones at the hangar screen are real — mobile-first responsive is required. The register default is product (leaderboard, nation sheets, vehicle pages, admin); the landing/hero is treated as brand per-task.

## Product Purpose

WT Records is the public, server-rendered world-record registry for War Thunder — most kills in a single life, per vehicle, per game mode. One verified current record per (vehicle, mode), superseded history behind it, per-mode completion and leaderboards derived live from the records. Success: the community treats it as the canonical record book — the place a claim is settled.

## Brand Personality

Authoritative · precise · celebratory. The record book of a competitive community: numbers speak for themselves, verification carries the authority, and record holders' feats get genuine celebration — never decoration for its own sake. Branding is typography-only for now: the wordmark is styled text ("WT·RECORDS" treatment), no logo or brand glyphs until stakeholders finalize identity.

## Anti-references

- Inter-everywhere generic SaaS styling; the templated dashboard look.
- Purple→blue gradients anywhere.
- Generic SaaS card-in-card layouts; nested cards.
- Gray-on-color text; muted-gray body copy over tinted surfaces.
- Note: frosted glass here is the deliberate, locked brand material (PRD §8) — not decorative default drift. The failure mode to avoid is glass without scrim-enforced legibility.

## Design Principles

1. **The number is the hero.** Records are the content; chrome recedes. Tabular numerics everywhere; rank metals (gold/silver/bronze) only where rank actually matters.
2. **Verification is the brand.** Verified/current status reads unambiguously on every surface; pending or superseded never masquerades as the title.
3. **Atmosphere behind, legibility in front.** Frosted glass floats over depth-processed in-game scenery (subject separated from background, parallaxing on pointer/gyro); a mode-adapted scrim/veil guarantees contrast — the scene is the visual identity, and it still never competes with data.
4. **Every mode is a world.** Mode is the top-level dimension: primary nav, URL, and page chrome reflect it; scenery swaps per nation and per branch.
5. **Celebrate the feat, not the interface.** Motion (count-ups, lifts, embers) is reserved for records and rank moments, always behind `prefers-reduced-motion`.

## Accessibility & Inclusion

WCAG 2.1 AA: ≥4.5:1 body-text contrast (scrim-enforced over imagery), ≥3:1 for large text, visible keyboard focus on every interactive element, full reduced-motion alternatives for all animation, mobile-first responsive. Tabular numerics double as a scanability aid for the records tables.
