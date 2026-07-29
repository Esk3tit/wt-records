---
timestamp: 2026-07-29T12-00-17Z
slug: src-components-site-nav-tsx
---
# Critique — the sticky site nav (`src/components/site-nav.tsx`)

Provenance: two isolated parallel sub-agents (Assessment A design review, Assessment B detector + browser evidence). Not degraded.
Mode: Operate. Heuristic mean 2.25 / 4. Design specificity 6 / 10.

## Root cause of the whole episode

`--ambient-thick` is `0 30px 60px -30px` — a token authored for tall cards. On a 59.5px nav the spread shrinks the shadow rect to `59.5 − 60 = −0.5px`: negative height, nothing painted. The nav had **never** cast a shadow, while its own comment claimed separation came from "the lit edge and the shadow." Every attempt to make the pane read as in-front therefore reached for the only lever that appeared to work — opacity — which is why the pane drifted to a 94% veil and lost the glass the design is built on.

Measured below the pane's edge at 3/8/16/32px, identical pixels:

| | @3px | @8px | @16px | @32px |
|---|---|---|---|---|
| dark, `--ambient-thick` | 62.2 | 63.2 | 64.8 | 64.8 |
| dark, `--ambient-nav-solid` | 37.5 | 45.1 | 54.1 | 61.9 |
| light, `--ambient-thick` | 224.7 | 225.2 | 228.2 | 229.2 |
| light, `--ambient-nav-solid` | 196.5 | 204.7 | 216.0 | 225.9 |

## Fixed in this pass

- **P1** `--ambient-nav-solid`: a nav-scale three-stop shadow whose first stop (`0 2px 4px -1px`) survives a shallow box. Veil returned to 35% glass.
- **P2** The risen pane widens to `70.5rem`, overhanging the 67.5rem content column every other pane shares, so its vertical edges land on open ground — and the widening is itself the state change, legible where a value shift was not.
- **P5** 62% veil below `40rem`, where the nav wraps to ~100px and overlaps far more content.

## Open, not fixed

- **P3 — plane inversion.** Nav veil 35% vs `.ledger-sticky[data-head-stuck]` at 94%: the *lower* sticky surface is ~2.7× more material than the upper one, so on `/grb/vehicles` the eye assigns "front" to the ledger head. Needs a stated invariant — *a sticky surface's veil must never exceed that of any sticky surface above it* — in DESIGN.md §Navigation.
- **P4 — mode switcher spec drift.** DESIGN.md prescribes Medal Amber for the active mode; shipped is `--pill-active` neutral white with a drop shadow, reading as an iOS `UISegmentedControl`. Inactive modes share `--fg-muted` with utility icons, against "important navigation is never muted into the background." The only amber in the switcher is the focus ring.
- **Contour continuity.** Card borders and link underlines cross the pane uninterrupted at full sharpness. Depth perception weights contour interruption above contrast attenuation; the new contact shadow addresses this at the boundary, not across the pane.
- **Touch targets** (issue #118) and **muted-ink contrast** (issue #119) both confirmed; #119's failing element is the site's primary navigation, which should raise its priority.
- **Minor:** nav padding computes to `10px 12px 10px 20px` against DESIGN.md's 24px for glass panels; no skip link past the sticky header; inactive mode hover has no surface; the active pill carries a shadow on a non-glass element.

## Strengths to protect

The parked state and the specular top edge (`--glass-highlight-strong`, correctly calibrated per mode). The state machine itself — thresholds read off measured geometry, 40px deadband, `data-live` gating, reduced-motion, `--nav-h` via `ResizeObserver`. The amber focus ring.
