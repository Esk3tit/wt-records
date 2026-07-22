---
target: "share-card prototypes (issue #17)"
total_score: 16
p0_count: 0
p1_count: 3
timestamp: 2026-07-21T06-47-08Z
slug: unfurl-proto-template-html
---
# Critique — WT Records share-card prototypes (issue #17)

Method: dual-agent (A: design review · B: detector + Playwright evidence)

## Design Health Score (adapted: static share image; 4 heuristics n/a)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Held / open bounty / completion states read clearly |
| 2 | Match system / real world | 4 | Domain-perfect voice: "single life", BR, "titles held" |
| 4 | Consistency & standards | 2 | Token drift (two golds, two bases); glass anatomy incomplete; nation number framed vs player number floating |
| 6 | Recognition not recall | 3 | "GRB" never expanded for newcomers |
| 8 | Aesthetic & minimalist | 2 | Player cards empty-not-minimal; nation card number-soup |
| 10 | Help & documentation | 2 | Only fallback card explains the product |
| Total (scored) | | 16/24 | Acceptable — solid skeleton, uneven investment |

## Priority issues
1. [P1] Two amber anchors per card — filled-amber GRB badge competes with amber hero number (One Amber Rule violation). Fix: neutralize badge to ink/hairline.
2. [P1] Glass material off-spec — missing inset Glass Highlight + ambient shadow; hairline 0.11 vs 0.16. Player panel vanishes at Discord scale. Fix: apply DESIGN.md glass anatomy.
3. [P1] Player card void + unframed number — give the number a frame (ring/medallion/rank-metal), fill panel with stat lines (best record, nations held, holder-since); avatars tracked in #85.
4. [P2] Small-size legibility — chips 5.4px effective at 432px; several labels 6.5–8px; 0.55–0.6-alpha ink smears. Fix: min ~26px type at 1200×630, informational ink ≥0.7 alpha.
5. [P2] Token drift + clipping — #e3b95e→#F0B94A, #0b0e14→#0A0C10 (or document deliberate card amber); explicit line-clamp/ellipsis for .vname (stress test measured 14px clip, no ellipsis).

## Measured evidence (Assessment B)
- Layout containment robust: 630px canvas held under worst-case mutation (longest name + 26-char Cyrillic + 4 chips). Failure mode is .vname text clipping, not layout explosion.
- Detector: 33 findings; Discord-chrome mockup values are false positives by construction; real drift = card gold/red rgba values + 7-8px sub-radii.
- Glass border 0.11 alpha ≈ invisible dark-on-dark at Discord scale (measured).

## Persona red flags
- Casey (mobile): player panel edge invisible; nation stats collapse at 432px — only the ring survives.
- Jordan (first-timer): GRB unexplained; product explained only on the fallback card.
- Record-holder: most personal card is the flattest — nothing celebratory.

## Minor
Wrong placeholder flag (mock only — real impl uses vendored SVGs); bounty threshold number deserves the amber more than the words; pname needs word-break policy.

## Questions
1. Why does the person get less design than the tank?
2. If the number is the hero, what is the badge doing in amber?
3. Is #e3b95e a decision or an accident?
