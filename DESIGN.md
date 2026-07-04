---
name: WT Records
description: Frosted-glass world-record registry for War Thunder — depth-parallax battle scenes behind, verified feats under lit glass in front, in dark and light.
colors:
  medal-amber: "#F0B94A"
  medal-amber-deep: "#8A6410"
  night-hangar: "#0A0C10"
  daylight-hall: "#F2F3F6"
  ink: "#FFFFFFF5"
  ink-muted: "#FFFFFF99"
  ink-faint: "#FFFFFF66"
  day-ink: "#0A0C10EB"
  day-ink-muted: "#0A0C109E"
  day-ink-faint: "#0A0C1073"
  hairline: "#FFFFFF29"
  day-hairline: "#0A0C101F"
  glass-highlight: "#FFFFFF33"
  night-scrim: "#04060A8C"
  day-veil: "#F2F3F699"
  ace-gold: "#FFD75E"
  squadron-silver: "#D6DBE2"
  veteran-bronze: "#E0995A"
  day-gold: "#7A6200"
  day-silver: "#57606C"
  day-bronze: "#8A5220"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
rounded:
  control: "4px"
  card: "22px"
  panel: "26px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.medal-amber}"
    textColor: "#000000"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  chip-removed:
    backgroundColor: "#FFFFFF1A"
    textColor: "{colors.ink-faint}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "2px 6px"
  nav-mode-active:
    backgroundColor: "transparent"
    textColor: "{colors.medal-amber}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
  glass-panel:
    backgroundColor: "#FFFFFF14"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
---

# Design System: WT Records

## 1. Overview

**Creative North Star: "The Trophy Hall"**

WT Records is a hall where verified feats hang under lit glass — and the hall has windows. Behind everything sits the system's signature element: the **Spatial Scene**, a curated War Thunder battle scene processed offline with depth AI so the subject — a tank, a plane — separates from its background and parallaxes on pointer and gyro, iOS-spatial-scene style. The scene is the visual identity. It swaps per nation and per branch, so every mode and every nation feels like its own room in the hall. In front of it: frosted-glass surfaces with hairline borders, tabular numerals, and instrument-panel restraint. Celebration is rationed — gold, silver, and bronze exist solely because rank is earned; Medal Amber marks what is active or actionable, never what is merely decorated.

The hall has two lighting states, never two identities. **By night** (dark mode): the Night Hangar base, scenes dimmed behind a dark scrim, white-frost glass, white ink. **By day** (light mode): the Daylight Hall base — cool, chroma-neutral off-white, no cream — scenes brighter under a light veil, milky frost with dark hairlines, dark ink. Structure, spacing, radii, type, and every named rule are identical in both; only the light changes. The theme follows the system preference with a persisted manual toggle.

This is a product surface in register (leaderboards, nation sheets, vehicle pages, admin) with one brand moment (the landing hero). It explicitly rejects the templated look: Inter-everywhere generic SaaS styling, purple→blue gradients, card-in-card layouts, gray-on-color text. Frosted glass is the deliberate, locked brand material — never allowed to cost legibility: the scrim (night) or veil (day), not hope, enforces contrast.

**Key Characteristics:**
- The Spatial Scene: depth-parallax battle imagery (subject-separated, offline-processed) as the identity layer in both modes
- Two lighting states, one hall: Night Hangar / Daylight Hall bases with mirrored ink, hairline, and scrim/veil tokens
- Luminous frost: white-alpha glass lit by the scene behind it (the scene bleeds through every pane), backdrop blur + saturate, 1px hairline borders, inset top highlight, 22–26px radii
- One warm accent (Medal Amber; Medal Amber Deep as its text-safe day form) at ≤10% of any screen; metals only where rank is real
- Tabular numerals everywhere; the number is the hero
- Floating panes: every glass surface carries a soft ambient shadow at rest — it hovers over the scene — deepening on lift

## 2. Colors

One committed base per lighting state, mirrored ink ramps, one warm accent with a day-safe deep form, and earned metals with day-safe deep forms.

### Primary
- **Medal Amber** (#F0B94A): the single accent. Fills (buttons) carry black text and work in both modes. As *text or active-state color it belongs to dark mode only.*
- **Medal Amber Deep** (#8A6410): the same voice by daylight — amber as text/active-state on light surfaces (≥4.5:1 on Daylight Hall). Fills stay #F0B94A in both modes.

### Neutral
- **Night Hangar** (#0A0C10): dark-mode body base — the hall at night.
- **Daylight Hall** (#F2F3F6): light-mode body base — cool, chroma-neutral off-white. Deliberately not cream, sand, or beige.
- **Ink ramp, night** — Ink (#FFFFFFF5 · rgba(255,255,255,.96)) primary text; Ink Muted (#FFFFFF99 · .6) secondary; Ink Faint (#FFFFFF66 · .4) tertiary/metadata only (fails 4.5:1 by design — never body copy).
- **Ink ramp, day** — Day Ink (#0A0C10EB · rgba(10,12,16,.92)); Day Ink Muted (#0A0C109E · .62); Day Ink Faint (#0A0C1073 · .45, tertiary/metadata only).
- **Hairline** (#FFFFFF29 · rgba(255,255,255,.16)) / **Day Hairline** (#0A0C101F · rgba(10,12,16,.12)): the 1px border on every glass surface, per mode. (Some early components ship rgba(255,255,255,.10); normalize to Hairline when touched.)
- **Glass Highlight** (#FFFFFF33 · rgba(255,255,255,.2)): the inset top edge that makes glass read lit — white in both modes (light catches the top of glass regardless of room lighting).
- **Night Scrim** (#04060A8C · rgba(4,6,10,.55)) / **Day Veil** (#F2F3F699 · rgba(242,243,246,.6)): the legibility layer between the Spatial Scene and the glass, per mode.

### Tertiary
- **Ace Gold** (#FFD75E), **Squadron Silver** (#D6DBE2), **Veteran Bronze** (#E0995A): rank metals by night (and as fills/badges in both modes).
- **Day Gold** (#7A6200), **Day Silver** (#57606C), **Day Bronze** (#8A5220): rank metals as text by day, contrast-safe on Daylight Hall.

### Named Rules
**The Same Hall Rule.** Light and dark are the same hall under different light. Tokens flip (base, ink, hairline, scrim/veil, deep accent/metal forms); structure, spacing, radii, type, and layout never do. A screen that rearranges between modes is broken.

**The Earned Metal Rule.** Gold, silver, and bronze (and their day forms) color only ranks 1, 2, and 3 — never headings, never icons, never decoration.

**The One Amber Rule.** Medal Amber (or its Deep day form) covers at most 10% of any screen: primary action, active mode, current selection, record emphasis. Two competing amber elements in one view means one of them is wrong.

## 3. Typography

**Display/Body Font:** system stack — ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter (single family, multiple weights)

**Character:** Quiet, native, instrument-precise. One well-tuned sans carries everything; hierarchy comes from a tight fixed-rem scale and weight, not from font pairing. All numerals are tabular — columns of kills align like a ledger. Identical in both lighting states.

### Hierarchy
- **Display** (700, 2.25rem, 1.1, -0.01em): landing hero and page-defining moments only.
- **Headline** (600, 1.5rem, 1.2): page titles — mode home, nation sheet, player profile.
- **Title** (600, 1.125rem, 1.3): section headings within a page.
- **Body** (400, 1rem, 1.5): prose and table content; cap prose at 65–75ch (data tables may run denser).
- **Label** (500, 0.75rem, 0.05em tracking, uppercase where used): metadata tags like the removed chip; used sparingly.

### Named Rules
**The Tabular Rule.** `font-variant-numeric: tabular-nums` applies globally, no exceptions. A kill count that shifts width when it changes is a bug.

## 4. Elevation

The page is a strict three-layer sandwich: **Spatial Scene** (WebGL canvas, depth-parallax imagery) at the bottom; the **scrim/veil** (Night Scrim or Day Veil, per mode) above it; **glass DOM surfaces** on top. Glass panes *float* over the scene (per the locked `wt-glass-concept.html`): each carries a soft, long-offset, negative-spread ambient shadow at rest that anchors it in the depth the parallax creates, alongside the material cues — backdrop blur + saturate, the 1px hairline border, the Glass Highlight top edge. Interaction deepens the float: hover/focus lifts the pane and strengthens its shadow.

### Shadow Vocabulary
- **Ambient thin, night** (`box-shadow: 0 8px 30px -12px rgba(0,0,0,.6)`): resting shadow on thin material — nav, small floating chrome.
- **Ambient deep, night** (`box-shadow: 0 30px 60px -30px rgba(0,0,0,.8)`): resting shadow on thick frost — hero, cards, panels (mid-weight surfaces may sit between, e.g. `0 20px 40px -24px rgba(0,0,0,.7)`).
- **Ambient thin, day** (`box-shadow: 0 8px 30px -12px rgba(10,12,16,.25)`) / **Ambient deep, day** (`box-shadow: 0 30px 60px -30px rgba(10,12,16,.35)`): the same anchoring by daylight.
- **Lift**: hover/focus deepens the pane's own ambient (roughly +4px offset, +20% alpha) with the spring-eased rise — a stronger float, not a new shadow.

### Named Rules
**The Floating Pane Rule.** Every glass surface floats: soft, negative-spread ambient shadow at rest, deepening on hover/focus lift. Shadows belong to glass panes only — never to text, buttons inside panes, or non-glass elements.

**The Sandwich Rule.** Text never sits directly on the Spatial Scene. Between any scene and any text there is always the mode's scrim/veil, a glass surface, or both. Contrast (≥4.5:1 body text) is enforced by the layer stack, not hoped for from whatever the screenshot happens to be.

## 5. Components

Instrument-precise; celebration only where earned. Controls feel like a machined instrument panel — quiet, exact, state-complete (default, hover, focus, active, disabled). Warmth appears only on records, ranks, and verified moments. Every component swaps tokens per mode and changes nothing else.

### The Spatial Scene (signature)
The identity layer. A small, curated, fixed set of battle scenes, each processed **offline once** into `image.jpg` + `image-depth.png` (depth AI; subject separated from background). Runtime renders one textured quad with a WebGL depth-displacement shader: UV offset by `depth.r × pointer/gyro`, nearer pixels moving more, displacement clamped to a few percent — subtle, Apple-like. Scenes swap per nation (and per branch across modes: ground vs air scenery). Above it sits Night Scrim or Day Veil, then the glass DOM. Fallbacks are part of the component, not afterthoughts: static image where WebGL is absent; effect disabled (static, veiled image) under `prefers-reduced-motion`; the 2-layer cutout (subject PNG over background, pure CSS transform) as the low-end path.

### Buttons
- **Shape:** small radius (4px) — controls stay compact instruments; the 22–26px radii belong to glass panels.
- **Primary:** Medal Amber fill, black text in both modes (6px 12px padding). Hover dims slightly; focus ring visible in the mode's accent form.
- **Ghost:** transparent with the mode's hairline border; muted ink brightening to full ink on hover.

### Chips
- **Removed tag:** faint fill (white .10 night / dark .08 day), the mode's faint ink, uppercase Label type, 4px radius, 2px 6px padding. Metadata register — informative, never alarming; removed vehicles are first-class citizens.

### Cards / Containers (Glass Panels)
- **Corner Style:** continuous radii from the locked band — 22px on mid-weight cards, 26px on thick panels (hero).
- **Background: luminous frost** — white-alpha fills so the Spatial Scene visibly lights the pane. Night: 6% thin (nav) / 8% mid (cards) / 12→5% gradient thick (hero); day: 40% / 50% / 65→35% gradient. Blur 24–50px + saturate 150–180%, scaling with material weight. The scene layer is deliberately bright enough to feed the frost.
- **Border:** 1px Hairline / Day Hairline, plus the Glass Highlight inset top edge (both modes).
- **Shadow Strategy:** the mode's Ambient (thin for nav, deep for cards/hero) at rest, deepening on hover/focus lift per Elevation.
- **Internal Padding:** 24px (xl).

### Inputs / Fields
- **Style:** faint fill, the mode's hairline border, 4px radius, full ink text.
- **Focus:** visible ring in Medal Amber (night) / Medal Amber Deep (day) — keyboard focus is part of the WCAG 2.1 AA floor, never suppressed.
- **Placeholder:** must meet 4.5:1 like any body text.

### Navigation
- **Mode switcher is the primary nav:** GRB/GAB/ARB/AAB as text links in the floating glass header (thin material) — active mode in Medal Amber / Medal Amber Deep, inactive in muted ink; 4px-radius hover surface. Nav links are not underlined (chrome opts out); content links keep underlines with 2px offset as a non-color affordance.
- **Theme toggle:** lives in the nav; follows `prefers-color-scheme` by default, persists a manual override. It flips tokens only (The Same Hall Rule).
- **Wordmark:** styled text `WT·RECORDS`, semibold, wide tracking — typography-only branding until identity is finalized.

### Record Monument (signature)
The mode's all-time high as a lock-screen moment inside the hero: a monumental amber numeral (clamp to ≤6rem) with an engraved plaque line (vehicle · holder · nation), an amber radial glow bleeding through the glass behind it, and the page's only count-up. With zero records it inverts — the count of open titles becomes the feat. This is the page's single amber moment (The One Amber Rule).

### Leaderboard Row (signature)
Rank number right-aligned in a fixed 1.5rem column — faint ink, or the mode's metal forms for 1/2/3 where medals are on — holder name as link, record count pushed to the row's end in muted ink, tabular numerals aligning every row into a ledger.

## 6. Do's and Don'ts

### Do:
- **Do** treat the Spatial Scene as first-class: every background ships as `image.jpg` + `image-depth.png` with a static fallback and a reduced-motion path; scenes swap per nation/branch.
- **Do** keep the sandwich intact (The Sandwich Rule): scene → scrim/veil → glass → text, in both modes.
- **Do** flip tokens between modes and nothing else (The Same Hall Rule) — same layout, same spacing, same radii, same rules.
- **Do** keep all numerals tabular (The Tabular Rule) — kills, counts, BRs, percentages.
- **Do** give every glass surface the full material: backdrop blur + saturate, the mode's 1px hairline, Glass Highlight inset top edge, and a band radius (22px card / 26px panel).
- **Do** keep amber ≤10% of any screen (The One Amber Rule), using Medal Amber Deep for text/active states by day; reserve metals for ranks 1/2/3 (The Earned Metal Rule) with Day Gold/Silver/Bronze as their text-safe day forms.
- **Do** ship every interactive component state-complete: default, hover, focus-visible, active, disabled.
- **Do** respect `prefers-reduced-motion` with a real alternative for every animation — parallax, count-ups, lifts.

### Don't:
- **Don't** use "Inter-everywhere generic SaaS styling; the templated dashboard look" (PRODUCT.md anti-reference) — the system font stack, glass materials, and the Spatial Scene are the identity.
- **Don't** use "purple→blue gradients anywhere" (PRODUCT.md anti-reference).
- **Don't** build "generic SaaS card-in-card layouts; nested cards" (PRODUCT.md anti-reference) — one glass layer, then content.
- **Don't** set "gray-on-color text" (PRODUCT.md anti-reference): on amber fills use black; on glass use the mode's ink ramp, never gray hexes.
- **Don't** put text directly on scene imagery — no exceptions (The Sandwich Rule).
- **Don't** use raw Medal Amber or the night metals as text on Daylight Hall — their Deep/Day forms exist precisely for that.
- **Don't** warm the light base toward cream/sand/beige; Daylight Hall stays cool and chroma-neutral.
- **Don't** use side-stripe borders (`border-left` > 1px as accent), gradient text, or the hero-metric template.
- **Don't** put shadows on anything that isn't a glass pane (The Floating Pane Rule) or metal colors on anything that isn't a rank.
