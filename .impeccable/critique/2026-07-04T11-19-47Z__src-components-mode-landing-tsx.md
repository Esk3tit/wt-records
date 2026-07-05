---
target: mode landing (/grb)
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-07-04T11-19-47Z
slug: src-components-mode-landing-tsx
---
Method: dual-agent (A: design-review agent · B: detector-evidence agent)

# Critique — mode landing (src/components/mode-landing.tsx, /grb)

## Design Health Score (Nielsen): 28/40 — Good

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | verified dates + queue status good; no last-updated signal |
| 2 | Match System / Real World | 3 | "57% Complete" lacks a referent; GRB/GAB codes unglossed (FIXED: aria-label/title gloss) |
| 3 | User Control and Freedom | 2→3 | marquee was uninteractable/clipped (FIXED: snap scroller + hover-paused drift, linked vehicles) |
| 4 | Consistency and Standards | 2→3 | Leaderboard/Standings naming triangle (FIXED); WeekCard vehicles now links like everywhere else |
| 5 | Error Prevention | 3 | read-only surface |
| 6 | Recognition Rather Than Recall | 3 | section asides gloss well |
| 7 | Flexibility and Efficiency | 3 | anchor pills + scroll-mt; no in-page vehicle lookup |
| 8 | Aesthetic and Minimalist Design | 3 | strong system; sparse data repeats the same record across sections |
| 9 | Error Recovery | 3 | empty states exist; sections self-remove |
| 10 | Help and Documentation | 3 | Rules pill first-class |
| **Total** | | **28/40 (~31 post-fixes)** | **Good** |

## Anti-Patterns Verdict
Not AI slop — art-directed. Detector CLI: clean (exit 0) on all 12 source files. In-page detector: 13 hits, 11 attributable to the TanStack devtools overlay (dev-only); genuine: hero-eyebrow (the *named* brand kicker — permitted as deliberate system) and tiny-text (11px sentence-content — FIXED to 12px; label scale stays 11px by design).

## Priority Issues
- [P1] --ink-faint failed WCAG AA (3.78:1 night / 3.07:1 day) on real content — **FIXED at token** (night 0.5 → 5.37:1; day 0.58 → 4.67:1; day muted 0.66 keeps tier separation).
- [P1] Week marquee: pointer-events none + overflow hidden clipped cards on mobile with no reveal, dead vehicle links — **FIXED** (snap scroller <4 cards; drift ≥4 pauses on hover/focus; VehicleLink).
- [P2] Mobile feed rail fixed 26rem = dead air reading as loading failure — **FIXED** (content-height below lg; fade only at lg+).
- [P2] RecordHistory single-step divide-by-zero path — **FIXED** (component guard; data layer already guaranteed ≥2).
- [P2] One Amber drift: LeaderboardList's amber track bars + amber counts form a second amber cluster competing with the monument — OPEN (design judgment; the accepted canvas showed amber bars).
- [P3] "57% Complete" referent; naming/order of quick links — naming/order FIXED; stat label OPEN.

## Persona Red Flags (remaining)
- Jordan: mode codes glossed now (aria-label/title) but visually still codes; "Complete" stat referent unclear.
- Grinder: "does my record still stand?" served only by Fallen (30d window) + header search; no check-a-vehicle affordance on the landing.
- Casey: record-history SVG labels effectively ~7px at 390px width.

## Audit Health Score: 17/20 — Good
| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3.5 | contrast fixed at token; heading outline clean (1×h1, 10×h2); aria-hidden discipline good; chart lacks data-table alternative |
| 2 | Performance | 3.5 | composited transforms only; blur cost is the locked material; marquee animates off-viewport (minor) |
| 3 | Responsive Design | 3.5 | 390/1440 both themes verified; chart labels tiny on mobile |
| 4 | Theming | 3.5 | token-driven; metal frosts are deliberate literals with explicit day variants |
| 5 | Anti-Patterns | 4 | detector clean; named-kicker + label-scale hits are documented brand systems |

## Questions to Consider
1. Should sections collapse below a data threshold (Week/History hidden until they'd differ from the podium) instead of re-serving the same record?
2. Would a "check a vehicle" input under the hero convert the grinder's core anxiety into the page's core loop?
3. Is "Complete" the right stat name, or "Coverage"?
