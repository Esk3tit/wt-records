# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The War Thunder records community: players chasing single-life kill records (grinders hunting open bounties), moderators verifying submissions, and visitors checking who holds a title. Gamers on desktop in dark rooms first, but phones at the hangar screen are real — mobile-first responsive is required.

## Product Purpose

WT Records is the public, server-rendered world-record registry for War Thunder — most kills in a single life, per vehicle, per game mode. One verified current record per (vehicle, mode), superseded history behind it, per-mode completion and leaderboards derived live from the records. Success: the community treats it as the canonical record book — the place a claim is settled.

## Positioning

The registry's standing rests on the corpus and the community's consent, not on its feature set: the GRB record book migrated here with the maintainer's own sheet as its source, verified by the moderators whose word already settled claims. Verification is the mechanism that earns that standing — every title carries checked evidence a moderator accepted — not a differentiator in itself. A copy of this software starts with no records and no moderators.

Consequently, nothing may make the number less trustworthy in order to buy a feature: no unverified row styled as a title, no third-party stats imported to fill coverage gaps, no silent rewriting of history.

## Operating Context

A record begins as a player's single-life run, evidenced by screenshots or video (scoreboard, end-game, end-life, or video proof). A holder submits it; a moderator reviews the evidence and verifies or rejects it; only then does it take the title, and only if it beats the standing one. Proof captured elsewhere (historically Imgur and Discord links) is mirrored into site-owned storage so the evidence outlives the host that first held it.

Identity is deliberately two-sided: most holders arrived through migration and have no account at all, while a logged-in User (Discord or Google) may claim a Player, subject to moderator approval, to take over its page and submit under it.

The vehicle catalogue is not hand-maintained — it syncs from an upstream datamine source, which is what makes coverage and completion real numbers rather than estimates. Records are stamped with the game patch they were set in, because the game itself changes underneath the record book.

## Capabilities and Constraints

- **Multi-mode by construction.** The registry is built around four game modes and opens them one at a time; every surface must survive a mode with zero records without looking broken. Mode is the top-level dimension of the site, not a filter.
- **Writes are moderator-gated.** Nothing publishes itself: both submissions and claims require moderator approval. Claims are never self-serve because impersonating a known holder would otherwise be one click.
- **Accountless holders are permanent and first-class.** A Player with no User is a valid end state, not an incomplete signup. Claiming adds to a page that already exists; a moderator revoking a claim returns the Player to that state with records untouched.
- **Removed vehicles stay in the book.** A vehicle pulled from the game keeps its page and its record, flagged as removed. History is never deleted for tidiness.
- **Runs on free-tier infrastructure, funded out of pocket.** Per-user cost is a real constraint on what can ship today. Whether paid tiers arrive later — as neighbouring sites like StatShark and ThunderSkill have — is deliberately undecided: do not design as though revenue exists, and do not foreclose it.
- **Terminology is fixed in `CONTEXT.md`.** User / Profile / Player / Holder / Claim / Alias / Record / Title and the rest are defined there and must not be redefined or conflated in product or interface work.

## Brand Personality

Authoritative · precise · celebratory. The record book of a competitive community: numbers speak for themselves, verification carries the authority, and record holders' feats get genuine celebration — never decoration for its own sake.

## Brand Commitments

- The product name is **WT Records**.
- Branding is typography-only for now: the wordmark is styled text (the "WT·RECORDS" treatment). No logo, no brand glyphs, until stakeholders finalize the identity — do not invent one.
- The site is a community project about War Thunder, not an official or endorsed product of the game's publisher, and must never imply otherwise.

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

## Evidence on Hand

Real, and usable in any surface that needs content:

- The migrated GRB corpus, live in production since July 2026: 1,131 records held by 269 players, with proof attached and provenance preserved from the original submissions (`docs/adr/0007-grb-migration-imgur-provenance.md`).
- Proof images and vehicle art mirrored into site-owned object storage, so screenshots render from the site rather than from whatever host first held them.
- The full vehicle catalogue with per-mode battle ratings, synced from upstream — the basis for real completion and open-bounty counts.

Absent, and never to be fabricated: testimonials, quotes from named players, press coverage, case studies, partner or publisher endorsement, pricing, traffic or user-count claims beyond the corpus above, and any record number not actually in the database.

## Accessibility & Inclusion

WCAG 2.1 AA: ≥4.5:1 body-text contrast (scrim-enforced over imagery), ≥3:1 for large text, visible keyboard focus on every interactive element, full reduced-motion alternatives for all animation, mobile-first responsive. Tabular numerics double as a scanability aid for the records tables.

Alt text on meaningful images leads with the factual description; personality or humor may follow it, never replace it — screen-reader users get the joke too. Purely decorative images use `alt=""`.
