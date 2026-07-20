---
target: src/routes/admin (moderator CMS, run 3)
total_score: 33
p0_count: 0
p1_count: 2
timestamp: 2026-07-19T19-47-35Z
slug: src-routes-admin
---
Method: dual-agent (A: a0ed8dde389a1e6ee · B: a6db90e7020d80789)

# Critique run 3 — WT Records moderator CMS (src/routes/admin), post-full-backlog fix

## Design Health Score: 33/40 (26 → 31 → 33 — Good, upper band)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | System status | 3 | Saved banner + counts + busy states; no pending signal on list reloads; sort state lacks aria-sort/affordance |
| 2 | Real-world match | 4 | Exemplary domain language |
| 3 | User control | 3 | Escape/cancel/dirty-blocker everywhere; blocker uses native window.confirm; no post-commit undo |
| 4 | Consistency | 3 | Ellipsis convention consistent; grey vs amber commit wobbles on catalog/attach |
| 5 | Error prevention | 4 | Consequence previews, threshold warnings, reason-gated retire, wheel guards, stale-response sequencing |
| 6 | Recognition | 4 | Context lines, prefills, full-entry echo in the confirm |
| 7 | Flexibility | 2 | Still no shortcuts, no save-and-add-another, 2 sortable columns |
| 8 | Minimalism | 4 | Exception-first ledger; norm rows quiet, pending/retired loudest |
| 9 | Error recovery | 3 | role=alert + dialog-closes-on-error; one-error-at-a-time validation |
| 10 | Help | 3 | Strong inline hints; no reference doc (acceptable at 5 mods) |
| **Total** | | **33/40** | **Good — the gap to great is batch speed (H7)** |

## Verified fixed from run 2 (measured)

- Focus continuity: Enter-select in the vehicle combobox lands focus on the "Change" button, never <body> — PASS (driven live).
- Sort works and is URL-reflected (?sort=kills, 35 ≥ 34); "Page 2 of 23" + "1,108 records" present.
- Proof thumbnails have explicit broken states; saved banner closes the loop; skip link present; migrated attribution shown; glyph tofu gone; consent banner out of the CMS; radius band aligned (4px controls); collapsed not-live rules; claimed-as-chip; clear-filter empty states.
- Contrast AA in both themes (light warn 4.84 tightest); detector clean (0 findings, --no-config confirmed); zero console errors; zero 390px overflow. All remaining overlay hits attributed to dev-only devtools style tags.

## New backlog

- [P1] Sortable headers invisible + no aria-sort/scope=col — Alex can't discover kills-sort; Sam's SR announces nothing. Fix: persistent ↕ affordance, aria-sort, scope=col.
- [P1] One-error-at-a-time entry validation (sequential early returns) — a three-gap form takes three attempts. Fix: collect all failures into one list.
- [P2] No save-and-add-another batch loop (highest-frequency flow).
- [P2] Dirty-nav guard is native window.confirm vs the designed dialog.
- [P2] Search placeholder clipped mid-word by max-w-64 ("…press Ent…"); Enter-only model taught by truncated text.
- [P2] No pending signal on filter/sort/page reloads (prod latency will read as dead clicks).
- [P3] Dialog rounded-[20px] + menu rounded-[14px] off the locked radius band; ?saved=true survives refresh; catalog summary copy stays "click to configure" while open; 390px column priority (Status off-canvas); backdrop lets the page's amber commit ghost through behind the modal's.

## Questions

1. Is the migration era over? If weekly entry dominates, save-and-add-another + shortcuts move toward P1; if bulk imports continue, a CSV path outranks both.
2. Should the live mode's "Save rules" be that view's amber commit?
3. Expand sorting (Player/Patch/Status) or is verified-desc deliberately canonical?
