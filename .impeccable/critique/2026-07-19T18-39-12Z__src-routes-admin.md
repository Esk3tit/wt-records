---
target: src/routes/admin (moderator CMS)
total_score: 26
p0_count: 2
p1_count: 3
timestamp: 2026-07-19T18-39-12Z
slug: src-routes-admin
---
Method: dual-agent (A: a7794b3c3baaeb151 · B: a36722d61b8c849bc)

> **Resolution note (post-snapshot):** this is the point-in-time record that drove the polish arc on the #15 branch. Both P0s (day-safe status tokens, restored input focus rings) and all three P1s (create-player row in the combobox keyboard cycle + result-count live region, proof thumbnails, filter-select width) were addressed in `476a252`; the re-critique backlogs followed in `b78814a` and `96f93fe` (trend 26 → 31 → 33; see the `2026-07-19T19-28-23Z` and `2026-07-19T19-47-35Z` snapshots). Findings below describe the pre-fix state by design — do not "fix" this file; run a fresh critique to update the trend.

# Critique — WT Records moderator CMS (src/routes/admin)

Inspected live at localhost:3100 (authenticated moderator, 1,108-record dataset), 1440×900 + 390×844, all seven admin surfaces + full source read.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading feedback on filter/nav; no total counts ("Page 2" of ???); active tab pill loses highlight when any filter is applied |
| 2 | Match System / Real World | 4 | Exemplary domain language: "Open bounty", "demotes", "takes the title", IGN snapshot |
| 3 | User Control and Freedom | 3 | Confirms everywhere; but no dirty-form guard (nav mis-click destroys a half-entered record); alias Remove unconfirmed |
| 4 | Consistency and Standards | 2 | Admin invents a grey button register (system primary is amber); chrome links underlined against DESIGN.md; off-token status colors |
| 5 | Error Prevention | 3 | Title-preview-before-commit exemplary; but scroll-wheel edits number inputs, no unsaved-changes guard |
| 6 | Recognition Rather Than Recall | 3 | Current-record context strip is superb; confirm modal hides the entry it commits |
| 7 | Flexibility and Efficiency | 1 | Zero shortcuts, no save-and-add-another, no sorting, Enter-only search undiscoverable, tiny row click targets |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained ledger; marred by full-width stacked filter selects and the 41-input rules dump |
| 9 | Error Recovery | 2 | role=alert + honest messages, but catalog's single ErrorNote renders below four panels — errors land off-screen |
| 10 | Help and Documentation | 3 | Good embedded hints; audit empty state explains nothing |
| **Total** | | **26/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

Does not read as AI-made. LLM review: none of the banned tells (no side-stripes, gradient text, hero-metric template, card grids, eyebrow kickers, nested cards); the ledger register fits the Trophy Hall. Deterministic scan: detect.mjs over src/routes/admin + src/components/admin → **0 findings (clean)**. Browser overlays: all 7 injected-overlay groups on every page were attributed by controlled re-scan to the dev-only TanStack Devtools widget (goober classes, injected styles) — false positives; surviving signals (single-font, flat 1.7:1 type ratio) are the design system's own deliberate choices. The only template-drift fingerprints in product code: raw Tailwind palette colors (emerald/amber/red-300) and the full-width filter-select bug.

## Overall Impression

An expert-grade interaction skeleton (consequence-preview confirms, context strips, honest copy) wearing an unfinished coat of paint: night-only status colors that vanish in light mode, suppressed input focus, a broken filter-bar layout, and zero amber where the system's primary-action register should be. The single biggest opportunity: make the evidence (proof) and the commitment moment (save/confirm) look as considered as the logic behind them.

## What's Working

1. Consequence-preview confirms — every consequential write states its outcome in domain language before committing ("Saving this demotes EpicBoozer's 24-kill record"). Rare error-safety design.
2. The entry-context strip: pick a vehicle, see the standing record and exact number to beat — the best working-memory bridge in the product.
3. Honest, precise UX copy throughout (merge panel, rename hint, failed-fetch combobox never lies with "No matches").

## Priority Issues

- [P0] Light mode broken for status/warn/danger: StatusChip + warnings + dangerButtonClass use emerald/amber/red-300 (night-only); "VERIFIED · CURRENT" measured ~1.4:1 on Daylight Hall. Fix: day-safe semantic tokens (verified/warn/danger, night+day forms) in styles.css, route all three through them. → /impeccable polish
- [P0] Inputs suppress keyboard focus: inputClass outline-hidden + faint border swap ≈ invisible; global amber :focus-visible ring suppressed on every field. Fix: drop outline-hidden. → /impeccable polish
- [P1] "Create player" unreachable by keyboard; combobox silent to screen readers (footer outside active-index cycle; no live region). Primary-flow dead end. Fix: footer row joins keyboard cycle; polite result-count announcement. → /impeccable polish
- [P1] Proof renders as raw storage paths, no thumbnails, in a verification tool (public site already has .proof-thumb). Fix: 10px-radius thumbnails + kind chip + original link. → /impeccable polish
- [P1] Filter selects render full-width/stacked (w-full in shared inputClass beats the appended w-auto): records + audit pages look broken, table pushed below fold. Fix: stop baking w-full into the shared class. → /impeccable layout (folded into polish)
- [P2] No commitment hierarchy and zero amber in the admin: Save/Cancel/Demote/Merge all same grey; one amber commit action per view (form submit + modal confirm). → /impeccable polish
- [P2] Batch-entry friction + silent data loss: no save-and-add-another, no autofocus, nav-away discards silently. → /impeccable polish (guard) + follow-up
- [P2] Measured: .text-fg-faint 4.44:1 on bg-tint-strong chips (marginal AA miss at 12px). → /impeccable polish

## Persona Red Flags

Alex (power user): 5-record Discord batch = re-navigation treadmill re-deriving mode/patch each time; Enter-only search with no affordance; no counts; no sorting; dead row area outside the name link; scroll-wheel number edits.

Sam (a11y): invisible input focus (P0); hard keyboard blocker creating a new player (P1); no aria-live for async/success; light-mode status contrast (P0). Keeps: proper combobox ARIA, sr-only labels, native dialog focus trap, role=alert.

## Minor Observations

Active-tab pill drops highlight when filters applied · chrome links underlined against DESIGN.md · WT marker glyphs render as tofu in tables · Run BR shows "6" not "6.0" (formatBr unused) · Rename button misaligned to hint baseline · combobox keeps stale text on blur · cookie consent banner inside CMS · mobile table clips kills/status with no scroll affordance · no pending/loading components anywhere (session-pooler latency will read as dead clicks in prod).

## Questions to Consider

1. If verification is the brand, why is the evidence the least-designed pixel in the CMS?
2. Is the admin deliberately a no-amber room — or did it just forget the system's primary-action register? Decide, and write it down in DESIGN.md either way.
3. Why is the rules editor schema-shaped (41 inputs, tank classes on air modes) instead of task-shaped (configured values + one "add threshold" affordance)?
