---
target: src/routes/admin (moderator CMS, post-polish)
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-19T19-28-23Z
slug: src-routes-admin
---
Method: dual-agent (A: a0112a41a219e40ef · B: a41288ea7ff321834)

# Critique re-run — WT Records moderator CMS (src/routes/admin), post-polish

Inspected live at localhost:3100 (authenticated moderator, 1,108 records), both themes, 1440×900 + 390×844; every polish fix independently re-measured.

## Design Health Score: 31/40 (was 26 — Good band)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 (+1) | Counts + URL-reflected filters now good; Verifier "—" on all migrated rows, Audit empty locally |
| 2 | Match System / Real World | 3 (-1) | Game marker glyphs render as tofu (␗ ◊ ■ ⋠); "Demote" unexplained beside "Retire…" |
| 3 | User Control and Freedom | 3 | Esc/cancel everywhere + dirty guard; no back link from detail, no clear-filters on empty state |
| 4 | Consistency and Standards | 3 (+1) | Status tokens list↔detail consistent; 10px admin control radius vs the documented 4px; Demote lacks the ellipsis+confirm posture of Retire |
| 5 | Error Prevention | 4 (+1) | Proof ≥1, threshold-before-entry, reason-gated retire, consequence confirm, dirty-form guard |
| 6 | Recognition Rather Than Recall | 4 (+1) | Context panel + prefills; typeahead caps at 8 without a "narrow further" hint |
| 7 | Flexibility and Efficiency | 2 (+1) | Still no sorting/shortcuts/bulk; combobox focus-drop forces pointer round-trips |
| 8 | Aesthetic and Minimalist Design | 3 | Dead/uniform columns (Verifier — ×1108, status uniform); three empty "not live yet" rules panes |
| 9 | Error Recovery | 3 (+1) | role=alert + specific messages; proof error unanchored to its field; broken thumbnail = silent grey box |
| 10 | Help and Documentation | 3 | Field microcopy exemplary; no shortcut reference; audit empty state unexplained |
| **Total** | | **31/40** | **Good — address weak areas, solid foundation** |

## Anti-Patterns Verdict

Not AI-made. detect.mjs: 0 findings (integrity-verified against a control file that fires 6). Overlay scan: 14 hits/page → all element-level hits attributed to dev-only TanStack Devtools by removal + goober-tag analysis; net product findings are single-font + flat type hierarchy (both deliberate DESIGN.md choices) and one likely detector false positive (scene-glow-cool blue-gray flagged as purple). One genuine non-CMS hit: consent-banner line length ~98ch (src/components/consent-banner.tsx:35).

## Fixes verified by measurement (all previous P0/P1s)

- Status ink AA in BOTH themes: verified 11.36:1 dark / 5.88:1 light; warn 13.57 / 4.84; danger 10.31 / 6.32.
- Focus rings visible both themes: 2px solid #F0B94A dark (10.2:1) / #8A6410 light (4.3:1) — never outline:none.
- Selects content-sized (110/121px), "1,108 records" total present, zero 390px overflow, zero console errors.
- Create-player row keyboard-reachable with ARIA-correct combobox + polite live regions; dirty-form guard works; amber commit register followed (one per view).

## Priority Issues (new backlog)

- [P1] Combobox selection drops focus to <body> — after Enter-select, next keystrokes go nowhere; highest-frequency flow, silent input loss. Fix: move focus to the "Change" button (or next field) on selection. → /impeccable polish
- [P1] Proof thumbnails fail silently — broken/missing asset renders a bare grey box with no error/retry (locally aggravated by prod-pointing R2 base URL, but the missing broken-state is real). Fix: explicit loading/broken states ("couldn't load — open original"). → /impeccable polish
- [P2] No sorting; cursor-only pager without "of N"; Players lacks a total. → /impeccable polish
- [P2] Dead/uniform ledger columns (Verifier "—", uniform status); consider exception-only status marking. Verifier populates for CMS-entered records; migrated rows are legitimately unattributed. → partially data, partly /impeccable distill
- [P3] Marker glyph tofu (␗ ◊ ■ ⋠) in names → strip/translate to chips at render. → /impeccable clarify
- [P3] Confirm dialog restates the demotion but not the entry itself (kills/vehicle/player echo would catch transpositions). → /impeccable clarify

## Persona Red Flags

Alex: focus-drop = 40+ pointer trips per 20-entry batch; still no save-and-add-another; no shortcuts; New record has no keyboard path.
Sam: focus-drop is the one real blocker left; possible weak focus affordance on the video-URL input under mouse focus (unconfirmed — all fields share inputClass; likely :focus vs :focus-visible observation); everything else passes (labels, dialog trap, live regions, contrast).

## Minor Observations

Consent banner inside the CMS (with the page's only competing amber) · edit fields ~500px wide for 2-digit values · three empty "not live yet" rules panes · "Page 1" without "of N" · retire placeholder truncates at rest · empty search state lacks one-click clear.

## Questions to Consider

1. Verifier "—" ×1,108: should migrated rows say "migrated" instead of an empty accountability column?
2. Should /admin wear the public chrome (mode nav, search, consent banner) at all?
3. What guards the exit? Post-save: land with an amber "current title" moment + audit trace visible, instead of a silent deposit.
