---
target: LiveFeed (kill-feed) on the mode landing — both themes, live motion
total_score: 24
p0_count: 0
p1_count: 1
timestamp: 2026-07-10T17-35-28Z
slug: src-components-live-feed-tsx
---
Method: dual-agent (A: design-review agent · B: detector-evidence agent)

> **Resolution note (post-snapshot):** this is the point-in-time record that drove the fixes on the #16 branch. The P1 (double-dim), both P2s (wash envelope, arrival layout-shift), and the P3 (day dot token, live-region silence, phantom eighth row) were addressed in `f64d550`; date contrast and kill-count emphasis followed in `84ecbe8`. Findings below describe the pre-fix state by design — do not "fix" this file; run a fresh critique to update the trend.

# Critique — LiveFeed (kill-feed) on the mode landing, both themes, live motion

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Dot claimed "live" through two distinct silent-delivery failures; day-granularity dates make even a working feed read stale |
| 2 | Match System / Real World | 3 | Kill-feed idiom + «as IGN» notation excellent; archive-voice dates contradict the live claim |
| 3 | User Control and Freedom | 2 | No way to see more than ~8 rows; no destination on tap; a row can exit mid-read |
| 4 | Consistency and Standards | 3 | Type ramp/hairlines honored; day-theme dot uses raw night amber (system's own Deep-form rule violated) |
| 5 | Error Prevention | 2 | Architecture can assert "live" without proof of delivery — false-positive state is structurally possible (and occurred) |
| 6 | Recognition Rather Than Recall | 4 | Inline chips self-explanatory; nothing to remember |
| 7 | Flexibility and Efficiency | 2 | Purely passive; no path from pane to a full records log |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained and quiet; wrapping prose rows scan worse than a columnar ledger; one row rendered at zero visibility |
| 9 | Error Recovery | 1 | When realtime dies the feed stales with the dot still pulsing; no degraded cue, no recovery |
| 10 | Help and Documentation | 3 | "Latest · verified" self-describing |
| **Total** | | **24/40** | **Functional, one credibility wound + real polish debt** |

## Anti-Patterns Verdict

**Not slop.** LLM assessment: bespoke tokens, real type ramp (Kicker header 11px/1.32px tracking, Data rows 13px — measured exactly on spec), honest empty state, reduced-motion gating, deliberate choreography. A Linear/Stripe-fluent user would initially trust it — then pause at ghost-dim top rows, wrapping prose rows, and (this morning) a pulsing live dot on a feed that never moved.

**Deterministic scan**: `detect.mjs` on `live-feed.tsx` + `mode-landing.tsx` → **0 findings**. In-page overlay reported 22 page-wide hits, but synthesis attributes most to false positives: 13× "1.0:1 white-on-white" are unresolvable glass/scene backgrounds, 3× clipped-overflow + cyan-gradient/gradient-text hits sit on goober-generated classes (dev-tooling internals, not project components). Real page-wide signals worth noting: the hero "Live registry" eyebrow chip (flagged as the tracked-caps kicker pattern — here it's the *deliberate, single* brand kicker, accepted), 2× ~99ch line-length, and one 1.8:1 amber-on-white measurement.

**Visual evidence**: overlays ran in a labeled tab during Assessment B; screenshots from Assessment A (night/day/mobile/arrival bursts) support every claim below.

## Overall Impression

The at-rest pane is genuinely good — a quiet ledger dissolving into the past, structurally identical across both themes. The wound: everything about the *live* promise. The dot vouched for two silent failure modes (both root-caused and fixed/actioned this session), the celebratory wash is nearly sub-perceptual after its first half-second, and on desktop the double-stacked dimming makes the feed's top read as a rendering bug. Biggest opportunity: make witnessing a record land actually feel like the peak the product exists for.

## What's Working

1. **At-rest composition.** Bottom-anchored log, linear 0.55→1.0 age gradient (measured exact), even hairlines, spec-true Kicker/Data typography. On mobile — no mask stacking — it reads exactly as designed.
2. **Honest motion engineering.** Enter/exit/wash CSS-gated behind reduced-motion; per-row exit deadlines survive bursts; 360ms exit collapse feels machined; the dot renders only from a real joined status.
3. **Theme integrity.** Night/day crops structurally identical; tokens flip, nothing shifts. Floating Pane Rule verified: zero shadows inside the pane (B measured).

## Priority Issues

- **[P1] Double-dimming makes the top of the feed unreadable at ≥1024px.** The inline age gradient (floor 0.55) multiplies with the `.feed-scroll` 26%-mask — measured effect: first visible row 2.04:1 text / 1.42:1 date (intent was ~0.55 ≈ 7:1-ish); DOM row 0 renders at literal zero visibility yet stays in the accessibility tree. Fix: let the mask own only the overflow crop; ease the inline floor to ~0.75 at lg+; don't render rows that can never be visible. *(/impeccable polish)*
- **[P2] The celebratory peak is sub-perceptual and leaves no trace.** Wash starts at 14% alpha but ease-out drops it under 10% within ~500ms against the warm scene glow; after 2.4s the just-landed record is indistinguishable from history ("10 Jul" like everything else). Fix: hold the wash near full strength ~600–800ms before easing (same 2.4s total); give the newest row a persistent recency cue until displaced (accent-ink date or minute-granularity "today" stamp — legitimate record-emphasis amber). *(/impeccable animate)*
- **[P2] Arrival shoves layout below lg.** Entering row adds height instantly while the exit takes 360ms to give it back — pane is one row taller for ~400ms, painting over the band below, then snaps. Fix: animate the entering row's height on the same curve so pane height stays net-constant. *(/impeccable adapt)*
- **[P2] "Joined" is not "delivering" — the dot can lie.** Two real occurrences this session: missing prod grant, and dropped filtered subscriptions on new Realtime versions. Both actioned (migration pending approval; client now subscribes unfiltered — fixed in `c21b29d`). The structural gap remains: the client has no delivery proof. Backstop if hard guarantees are ever wanted: periodic reconcile poll; at minimum, don't let the date column contradict the live claim. *(/impeccable harden)*
- **[P3] Day-theme dot + silent AT.** Dot is raw Medal Amber (#F0B94A) on Daylight Hall (~1.5:1; system mandates the Deep form by day; WCAG 1.4.11 wants 3:1). The list has no live-region semantics and the dot is aria-hidden with no text equivalent — screen-reader users get neither live status nor arrivals, and currently hear an extra invisible row. Fix: theme-flip the dot token; `role="log"` + visually-hidden "Live" affix. *(/impeccable polish)*

## Persona Red Flags

- **Second-monitor passive watcher** (the pane's flagship persona): even with delivery fixed, a 2.4s evaporating wash plus day-granularity dates give a glancer no way to tell something landed while they looked away.
- **First-time visitor from reddit**: first impression of the pane is 2:1 ghost rows stamped "6 Jul" — reads broken *and* abandoned on a site whose currency is authority.
- **Screen-reader user**: hears eight rows when seven are visible, is never told the feed is live, never hears a record land.

## Minor Observations

- Continuation lines start under the date; a fixed-width date column would restore ledger alignment ("6 Jul" vs "10 Jul" currently produce ragged starts).
- The hero monument hard-swaps on a live all-time high (42→58 between frames) with zero ceremony — the page's one count-up doesn't fire for the most dramatic live event the product has.
- Consent banner reappeared after acceptance during the session — persistence looks flaky (outside the feed; separate issue).
- One Amber census at arrival: within the ≤10% rule, but the strongest amber fill a first-time visitor sees is the cookie Accept button, outshining every record.
- Kills — the number the product is about — sit mid-prose at body weight inside feed rows ("the number is the hero" rule unapplied here).

## Questions to Consider

1. Is "live" the honest register for a moderated ledger? Records land on *verification* — maybe the wash celebrates verification, and the dot's promise is "you won't miss the next one" (which the engineering must then keep).
2. Is this a feed or a decoration? No affordance to see more, no destination on tap — if arrivals matter, where does the full history live?
3. Who sees the landing on mobile, where the pane sits below the fold? Should an arrival escalate (mode-pill glint) — or is missing it the point of a hall rather than a ticker?
