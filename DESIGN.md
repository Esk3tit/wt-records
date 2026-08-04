---
name: WT Records
description: Frosted-glass world-record registry for War Thunder — depth-parallax battle scenes behind, verified feats under lit glass in front, in dark and light.
colors:
  medal-amber: "#F0B94A"
  medal-amber-deep: "#7A580D"
  night-hangar: "#0A0C10"
  daylight-hall: "#F2F3F6"
  ink: "#FFFFFFF5"
  ink-muted: "#FFFFFFBF"
  ink-faint: "#FFFFFFAD"
  day-ink: "#0A0C10EB"
  day-ink-muted: "#0A0C10BD"
  day-ink-faint: "#0A0C10AD"
  hairline: "#FFFFFF29"
  day-hairline: "#0A0C101F"
  pill-active: "#FFFFFF24"
  day-pill-active: "#FFFFFFE6"
  glass-highlight: "#FFFFFF38"
  day-glass-highlight: "#FFFFFFE6"
  night-scrim: "#080A0E80"
  day-veil: "#F2F3F699"
  ace-gold: "#FFD75E"
  squadron-silver: "#D6DBE2"
  veteran-bronze: "#E3A36A"
  day-gold: "#6E5800"
  day-silver: "#4F5863"
  day-bronze: "#7E4B1D"
  service-green: "#6FA05C"
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
  lede:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-compact:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4
  data:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
  kicker:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.12em"
rounded:
  micro: "2px"
  control: "4px"
  media: "10px"
  card: "22px"
  panel: "26px"
  pill: "999px"
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
    backgroundColor: "{colors.pill-active}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
  glass-panel:
    backgroundColor: "#FFFFFF14"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  input-search:
    backgroundColor: "#FFFFFF0F"
    textColor: "{colors.ink}"
    rounded: "{rounded.media}"
    padding: "6px 12px"
  filter-chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.media}"
    padding: "4px 10px"
  filter-chip-active:
    backgroundColor: "{colors.pill-active}"
    textColor: "{colors.ink}"
    rounded: "{rounded.media}"
    padding: "4px 10px"
---

# Design System: WT Records

## 1. Overview

**Creative North Star: "The Trophy Hall"**

WT Records is a hall where verified feats hang under lit glass — and the hall has windows. Behind everything sits the system's signature element: the **Spatial Scene**, a curated War Thunder battle scene processed offline with depth AI so the subject — a tank, a plane — separates from its background and parallaxes on pointer and gyro, iOS-spatial-scene style. The scene is the visual identity. It swaps per nation and per branch, so every mode and every nation feels like its own room in the hall. In front of it: frosted-glass surfaces with hairline borders, tabular numerals, and instrument-panel restraint. Celebration is rationed — gold, silver, and bronze exist solely because rank is earned; Medal Amber marks what is actionable or achieved, never where you are and never what is merely decorated.

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
- **Medal Amber** (#F0B94A): the single accent. Fills (buttons) carry black text and work in both modes. As *text color it belongs to dark mode only.*
- **Medal Amber Deep** (#7A580D): the same voice by daylight — amber as text on light surfaces (≥4.5:1 on the *glass*, not merely on Daylight Hall). A pane floating over the day scene is a shade darker than the base, so the base is the wrong thing to calibrate a day ink against. Fills stay #F0B94A in both modes.

### Neutral
- **Night Hangar** (#0A0C10): dark-mode body base — the hall at night.
- **Daylight Hall** (#F2F3F6): light-mode body base — cool, chroma-neutral off-white. Deliberately not cream, sand, or beige.
- **Ink ramp, night** — Ink (#FFFFFFF5 · rgba(255,255,255,.96)) primary text; Ink Muted (#FFFFFFBF · .75) secondary; Ink Faint (#FFFFFFAD · .68) tertiary/metadata.
- **Ink ramp, day** — Day Ink (#0A0C10EB · rgba(10,12,16,.92)); Day Ink Muted (#0A0C10BD · .74); Day Ink Faint (#0A0C10AD · .68, tertiary/metadata).
- **The secondary steps are set on the panes, not on the base.** A pane is glass over a lit scene, so its ink meets whatever the scene puts under it — the base is the one surface the number does not depend on, and a step calibrated there is calibrated against nothing it will ever sit on. These are the measured floor; `e2e/ink-contrast.spec.ts` is what keeps them honest. The gap between muted and faint is deliberately narrow, because that is what the panes leave: metadata is quiet by size, case and tracking, never by being unreadable.
- **Hairline** (#FFFFFF29 · rgba(255,255,255,.16)) / **Day Hairline** (#0A0C101F · rgba(10,12,16,.12)): the 1px border on every glass surface, per mode. (Some early components ship rgba(255,255,255,.10); normalize to Hairline when touched.)
- **Glass Highlight** (#FFFFFF38 · rgba(255,255,255,.22) night / #FFFFFFE6 · .9 day): the inset top edge that makes glass read lit. White in both modes — light catches the top of glass regardless of room lighting — but daylight needs a near-opaque edge to read against a bright veil, where night needs only a whisper.
- **Night Scrim** (#080A0E80 · rgba(8,10,14,.5)) / **Day Veil** (#F2F3F699 · rgba(242,243,246,.6)): the legibility layer between the Spatial Scene and the glass, per mode. The quoted value is the outer stop of the gradients, which close at the frame edges and clear toward the centre so the scene still breathes. Under them each mode lays a flat floor of its own colour — Night Scrim at .42, Day Veil at .44 — because the centre they clear toward is where the content column sits, and a layer that guarantees nothing where the reading happens guarantees nothing.

### Tertiary
- **Ace Gold** (#FFD75E), **Squadron Silver** (#D6DBE2), **Veteran Bronze** (#E3A36A): rank metals by night. Each has an **ink form and a material form**, the way amber has Medal Amber and Medal Amber Deep, and they are deliberately not the same value: the material is the tint a rank's pane wears (#FFD75E / #D6DBE2 / #E0995A as fills, washes and badges in both modes), while the ink is what a rank is *written* in on that pane. Only bronze's two forms diverge, because it is the one metal near enough the glass's own luminance for the tint and the type to read as two mid-luminance layers meeting.
- **Day Gold** (#6E5800), **Day Silver** (#4F5863), **Day Bronze** (#7E4B1D): rank metals as text by day, measured on the tinted pane a rank is actually written on rather than on Daylight Hall itself.

### Acquisition materials
Not ink and not accent — two gradient washes laid over a glass fill, so acquisition reads as what the surface is *made of*. **Medal Amber** gilds premium; **Service Green** (#6FA05C) is squadron's, the only hue in the system that exists solely as a material and never as text, border, or icon. Each ships at two strengths from one vocabulary: card (`.acq-premium` / `.acq-squadron`) and pane (`.acq-pane`), the latter quieter because a title sheet wears it over an order of magnitude more surface. Event and removed take no material — their chips carry them.

### Named Rules
**The Same Hall Rule.** Light and dark are the same hall under different light. Tokens flip (base, ink, hairline, scrim/veil, deep accent/metal forms); structure, spacing, radii, type, and layout never do. A screen that rearranges between modes is broken.

**The Earned Metal Rule.** Gold, silver, and bronze (and their day forms) color only ranks 1, 2, and 3 — never headings, never icons, never decoration.

**The One Amber Rule.** Medal Amber (or its Deep day form) covers at most 10% of any screen, and marks three things: the **primary action** (the commit), **record emphasis** (the feat, including the recency glow on one that landed today), and the **hero kicker** that opens a mode landing, which is brand cadence rather than a state. Never selection, never position, never "you are here". Two competing amber elements in one view means one of them is wrong. The premium acquisition wash is exempt — it is a *material*, not the accent doing accent work; the amber **ink** on the same screen still counts.

**The Rationed Colour Rule.** A colour whose meaning comes from *scarcity* cannot live where recurrence is guaranteed, and recurrence is counted in **resting ink**: the accent work a page paints before anyone touches it. Persistent chrome (the nav, and anything else met on every page and not dismissible) is guaranteed recurrence, so Medal Amber and the rank metals never rest there. Three things fall outside that count rather than being pardoned by it. **Summoned ink spends no ration:** the focus ring stays amber in the nav as everywhere else (see Inputs / Fields, never suppressed), rationed by the platform to one element, on keyboard focus, gone on blur. **Material is not ink**, the carve-out The One Amber Rule already makes for the acquisition wash: the Spatial Scene's embers are night atmosphere, not the accent doing accent work. **A surface with an end does not recur**, which is why the consent banner commits in the amber primary even though it repeats until answered. Only one amber genuinely rests in chrome, exempt on its own ground: the wordmark's separator is a mark and carries no reading, the same subtree `e2e/nav-contrast.spec.ts` exempts by name. A colour whose meaning is *state* is the opposite case and belongs in chrome, because chrome is where state is shown. This rule is why the two above exist, and it adds one bar of its own: not even a sanctioned amber rests in chrome, since a ceiling holds only if amber is absent from the surfaces that repeat.

## 3. Typography

**Display/Body Font:** system stack — ui-sans-serif, system-ui, -apple-system, 'SF Pro Text', Inter (single family, multiple weights)

**Character:** Quiet, native, instrument-precise. One well-tuned sans carries everything; hierarchy comes from a tight fixed-rem scale and weight, not from font pairing. All numerals are tabular — columns of kills align like a ledger. Identical in both lighting states.

### Hierarchy
- **Display** (700, 2.25rem, 1.1, -0.01em): landing hero and page-defining moments only.
- **Headline** (600, 1.5rem, 1.2): page titles — mode home, nation sheet, player profile.
- **Title** (600, 1.125rem, 1.3): section headings within a page.
- **Lede** (400, 1.0625rem, 1.5): intro paragraphs and emphasized row values — one notch above body, never for headings.
- **Body** (400, 1rem, 1.5): prose and table content; cap prose at 65–75ch (data tables may run denser).
- **Body compact** (400, 0.9375rem, 1.4): explanatory copy inside panes and filter/control text.
- **Data** (400, 0.8125rem, 1.45): the ledger register — feed rows, captions, table metadata; usually paired with tabular numerals.
- **Label** (500, 0.75rem, 0.05em tracking, uppercase where used): metadata tags like the removed chip; used sparingly.
- **Kicker** (600, 0.6875rem, 0.12em tracking, uppercase): micro section labels — the smallest step, always tracked and uppercase, never for running text. Two sanctioned wider forms: ruled section labels and page eyebrows track at 0.2em, and the hero `.kicker` alone widens to 0.24em.
- **Stat label** (`.stat-label` — 500, 0.6875rem, 0.08em tracking, uppercase): the caption under or beside a number — RECORDS, HOLDERS, DAYS UNTOUCHED, TITLES BY NATION. Kicker's size, one notch tighter and one weight lighter, because it attends a numeral instead of opening a section. Ink is the call site's choice: muted for a label the eye should find, faint for pure metadata.
- **Stat unit** (`.stat-unit` — 500, 0.06em tracking, muted ink): the lowercase word trailing a numeral — *kills*, *records*, *held*. Size follows the number it trails (0.6875–0.9375rem), so it stays a call-site choice; everything else is fixed.

**The open-tracking ladder is closed at six steps.** Across the tracked micro-registers — Label, Stat unit, Stat label, Kicker, ruled section labels, hero kicker — positive tracking takes exactly six values: 0.05em (Label), 0.06em (Stat unit), 0.08em (Stat label), 0.12em (Kicker), 0.2em (ruled section labels and page eyebrows), 0.24em (the hero `.kicker` alone). No seventh exists — a new one means the register already exists and you haven't found it. Display type and standalone numerals run the opposite axis, tightening optically as they grow (-0.01em at Display, to -0.03em on the largest figures); that axis never borrows a step from this ladder.

### Named Rules
**The Tabular Rule.** `font-variant-numeric: tabular-nums` applies globally, no exceptions. A kill count that shifts width when it changes is a bug.

**The Attending Type Rule.** Type that attends a number is never invented at the call site: the uppercase caption is `.stat-label`, the lowercase unit is `.stat-unit`. Both are layered under Tailwind's utilities, so a site may override ink or weight for emphasis (the vehicle sheet's semibold "HOLDS IT") — but never size, tracking, or case.

### Share-card faces (the one exception to the system stack)
Share cards (`/og/*`, issue #17) render server-side to a static 1200×630 image, where the live system font stack isn't available — so they embed two self-hosted OFL faces, used **nowhere else**: **Saira** (square HUD character — hero numerals, vehicle names, wordmark; tabular figures) and **Golos Text** (Cyrillic-native — player names, labels, chips). Same hierarchy intent as the site (the number is the hero, one amber anchor), just carried by embedded faces the renderer can rasterize. Legibility floor for the card medium: no informational text below ~26px at 1200×630 (~9.4px at Discord's 432px render), informational ink ≥0.7 alpha.

## 4. Elevation

The page is a strict three-layer sandwich: **Spatial Scene** (WebGL canvas, depth-parallax imagery) at the bottom; the **scrim/veil** (Night Scrim or Day Veil, per mode) above it; **glass DOM surfaces** on top. Glass panes *float* over the scene (per the locked `wt-glass-concept.html`): each carries a soft, long-offset, negative-spread ambient shadow at rest that anchors it in the depth the parallax creates, alongside the material cues — backdrop blur + saturate, the 1px hairline border, the Glass Highlight top edge. Interaction deepens the float: hover/focus lifts the pane and strengthens its shadow.

### Shadow Vocabulary
- **Ambient thin, night** (`box-shadow: 0 8px 30px -12px rgba(0,0,0,.6)`): resting shadow on thin material — the parked nav, small floating chrome.
- **Ambient deep, night** (`box-shadow: 0 30px 60px -30px rgba(0,0,0,.8)`): resting shadow on thick frost — hero, cards, panels (mid-weight surfaces may sit between, e.g. `0 20px 40px -24px rgba(0,0,0,.7)`).
- **Ambient thin, day** (`box-shadow: 0 8px 30px -12px rgba(10,12,16,.25)`) / **Ambient deep, day** (`box-shadow: 0 30px 60px -30px rgba(10,12,16,.35)`): the same anchoring by daylight.
- **Lift**: hover/focus deepens the pane's own ambient (roughly +4px offset, +20% alpha) with the spring-eased rise — a stronger float, not a new shadow.

### Named Rules
**The Floating Pane Rule.** Every glass surface floats: soft, negative-spread ambient shadow at rest, deepening on hover/focus lift. Shadows belong to glass panes only — never to text, buttons inside panes, or non-glass elements.

**The Sandwich Rule.** Text never sits directly on the Spatial Scene. Between any scene and any text there is always the mode's scrim/veil, a glass surface, or both. Contrast (≥4.5:1 body text) is enforced by the layer stack, not hoped for from whatever the screenshot happens to be.

**The scrim is shape over a floor.** The gradients are the mood; the flat layer beneath them is the guarantee. What that floor buys is finite and measured: the night stack bounds a scene to #202020 and the day stack to #E0E0E0, and `e2e/ink-contrast.spec.ts` floods the scene layer at exactly those edges. Beyond them no ink on any pane clears, and closing the gap would take a scrim opaque enough to erase the scene. **So the band is a constraint on scene art, not a free parameter** — a brighter night plate is a legibility change and fails a test before it ships. It floods flat, so it bounds a plate's exposure and not a local specular: a scene is still something to look at before shipping, not only to test.

## 5. Components

Instrument-precise; celebration only where earned. Controls feel like a machined instrument panel — quiet, exact, state-complete (default, hover, focus, active, disabled). Warmth appears only on records, ranks, and verified moments. Every component swaps tokens per mode and changes nothing else.

### The Spatial Scene (signature)
The identity layer. A small, curated, fixed set of battle scenes, each processed **offline once** into `image.jpg` + `image-depth.png` (depth AI; subject separated from background). Runtime renders one textured quad with a WebGL depth-displacement shader: UV offset by `depth.r × pointer/gyro`, nearer pixels moving more, displacement clamped to a few percent — subtle, Apple-like. Scenes swap per nation (and per branch across modes: ground vs air scenery). Above it sits Night Scrim or Day Veil, then the glass DOM. Fallbacks are part of the component, not afterthoughts: static image where WebGL is absent; effect disabled (static, veiled image) under `prefers-reduced-motion`; the 2-layer cutout (subject PNG over background, pure CSS transform) as the low-end path.

### Buttons
- **Shape:** small radius (4px) — controls stay compact instruments; the 22–26px radii belong to glass panels.
- **Primary:** Medal Amber fill, black text in both modes (6px 12px padding). Hover dims slightly; focus ring visible in the mode's accent form.
- **Ghost:** transparent with the mode's hairline border; muted ink brightening to full ink on hover.
- **Back of house (/admin):** the amber primary marks only the single commit action per view (form submit, dialog confirm); every other admin control stays in the ghost/grey register. Status ink uses the semantic tokens (verified/warn/danger) with day-safe forms, mirroring the accent's Deep pattern.
- **Glass pill** (live-accepted at frost .12 / float .2): section-nav capsule that is a small liquid-glass pane in its own right — 999px radius, full ink at weight 550, 12% white-alpha fill with blur 36/saturate 180%, specular edges, a subtle 3px anchor shadow rising 2px on hover. **Inside this capsule** navigation is never muted into the background — every item is a peer and ink weight is the only thing that could mark position, so spending it costs the set its legibility. A control that carries position in its own surface instead — a track, an active fill and `aria-current`, as the mode switcher has — is the opposite case, and mutes its inactive items deliberately.
- **Every control reaches 44px, and the ink grows only where it must.** `.tap-reach` hands the hit area a 44px square as a pseudo-element, so a thumb gets its target while the ink keeps the size the type scale gave it and the pane keeps its height. It buys reach, never room: two reaches must be kept 44px apart centre to centre, or the later one silently takes the overlap. In a row that stack is a gap to widen; in a wrapping grid of chips it is a pitch to hold — chip height plus row gap, and chip width plus column gap, both at 44 or more, which is why filter chips carry a 44px minimum width and never sit closer than that on either axis. Two things the pseudo-element cannot serve: `input` and `select` are replaced elements and take no `::after` at all, so a field's 44px is real height; and a wrapper is not a substitute, since a tap it receives never reaches the control inside. A reach is only ever proven by measuring the box a control actually owns, never the one its CSS claims.

### Chips
- **Removed tag:** a fill that **recesses** (`--tint-well`: black .30 night / Night Hangar .08 day), the mode's **full** ink, uppercase Label type, 4px radius, 2px 6px padding. Metadata register — informative, never alarming; removed vehicles are first-class citizens. Full ink is the one place metadata takes the primary step, because a chip lays its own fill under its own text. That fill has to darken in both modes, which is the correction day already had and night did not: measured on a lit pane, full ink over a white .10 night fill still came back 4.08, and there is no ink above full to answer with. Size, case and tracking are what keep a chip quiet here, not ink.

### Cards / Containers (Glass Panels)
- **Corner Style:** continuous radii from the locked band — 22px on mid-weight cards, 26px on thick panels (hero); 10px on embedded media (proof thumbnails), 2px micro-radius on chip-scale marks (flag chips).
- **Background: ultra-clear liquid glass** (live-accepted at frost 0.10 / blur 50) — white-alpha fills so the Spatial Scene reads through the pane in both modes. Night: 6% thin (nav) / 8% mid (cards) / 12→5% gradient thick (hero); day: 8% / 10% / 16→7% gradient. Blur 36–60px + saturate 180–200%, scaling with material weight. Every pane carries a 1.5px specular top edge (Glass Highlight) and a 0.5px bottom inner edge (Glass Edge). The scene layer is deliberately bright enough to feed the frost.
- **Border:** 1px Hairline / Day Hairline, plus the Glass Highlight inset top edge (both modes).
- **Shadow Strategy:** the mode's Ambient (thin for nav, deep for cards/hero) at rest, deepening on hover/focus lift per Elevation.
- **Internal Padding:** 24px (xl).

### Inputs / Fields
- **Two registers.** Back-of-house (/admin) fields stay machined instruments: faint fill, the mode's hairline border, 4px control radius. Front-of-house search fields (hero lookup, Browse name filter, /search) are softer objects at the 10px media radius — they sit beside 10px chips and pagination pills, not beside admin controls.
- **Style:** faint fill, the mode's hairline border, full ink text.
- **Focus:** visible ring in Medal Amber (night) / Medal Amber Deep (day) — keyboard focus is part of the WCAG 2.1 AA floor, never suppressed.
- **Placeholder:** must meet 4.5:1 like any body text.
- **A field's 44px is real height.** `input` and `select` are replaced elements and hold no pseudo-element, so they cannot borrow the reach every other control gets — they carry the floor in their own box (see Buttons).

### Navigation
- **Mode switcher is the primary nav:** GRB/GAB/ARB/AAB as text links in the floating glass header (thin material when parked) — the active mode in the neutral **pill-active** fill at full ink, inactive in muted ink; 4px-radius hover surface. **Pill-active is the site's one selected-state vocabulary**, not a nav token: where a set of peers is offered and one is chosen, the chosen one takes this fill, whether it is a mode, a filter chip, a ledger page, an admin tab or an option in a lookup. The ledger's sort headers are the deliberate exception, marking the chosen column in full ink with a direction glyph, because a sort has to say which way as well as which. Three conveniences borrow the token without meaning selection (the admin button register, the admin skip link, and the filter count badge), so a remap of the selection hue has to give those a token of their own first, or it recolours things nobody chose. The accent is deliberately not spent here — see The Rationed Colour Rule; the switcher sits in chrome, so amber in it would be amber on every page. Nav links are not underlined (chrome opts out); content links keep underlines with 2px offset as a non-color affordance.
- **The nav rests clear, then turns solid.** Parked at the top of a page it is thin glass and the Spatial Scene reads through it. Once content slides under it the pane cross-fades to the thick fill over a near-opaque base, gains the hover hairline as a lit edge, and drops the deep ambient shadow — the overlap must read as one pane above another, never two transparent panes colliding. Frost alone cannot do this: `backdrop-filter` does not sample the sibling content a sticky pane overlays, the same limit that gives the floating menus and the pinned ledger head their near-opacity. The turn-solid and clear-again lines are measured off the nav's own bottom edge and sit 40px apart, so scroll jitter at the boundary cannot strobe the state.
- **The risen veil is a legibility floor, not a mood.** It is the only thing standing between the nav's own labels and whatever is scrolling beneath them, and a bright line of type passing under a thin pane will beat *any* ink — there is no colour that reads at 4.5:1 over an unbounded backdrop. So the veil is sized to what its labels need, not to taste: measured against a pure white and a pure black band, 75% is the floor at which every label still clears 4.5:1, and one value serves every width. Day sets that floor, not night. **Those two bands bound the inks the nav carries today, and only those.** Contrast is minimised where the backdrop's luminance equals the ink's — an interior point, not an extreme — so white and black are the worst case only for ink lying outside the range the veil leaves reachable (dark ≈ 0.005–0.09, light ≈ 0.53–0.92). An ink inside that range is bounded by nothing here until a band at its own luminance is pinned under the pane. The nav's utility ink — search, theme, Admin — is full-strength for the same reason, and marks its hover with the pill track rather than with more ink: a fill of its own would only lighten the surface it has to be read on. Only the risen pane veils; parked, the nav is thin glass and its ink clears the floor without help.
- **The utility cluster speaks one vocabulary.** Search, Admin and the theme toggle are all 16px icons on a 32px ink box (the reach comes separately — see Buttons), because each is a destination or a control and none of them is the page's subject. A word among them costs more than it explains: `ADMIN` was the widest ink in the cluster and the reason the pane wrapped to a third row on a 320px phone, moving every control a moderator uses at exactly one width. An icon only moderators ever see is not there to teach a stranger — it is there to sit still, so it carries its name in `aria-label` and no tooltip its neighbours lack.
- **Below 360px the pane draws in.** Row one has to seat the wordmark beside three 32px icons, and the cluster cannot yield — three 44px reaches fix its width at roughly one icon plus 92px, so shrinking an icon buys back its own pixel and nothing more. Everything else gives instead: the pane's inset goes symmetric at 12px, the row gap to 12px, and the wordmark one step down the scale to meet the mode pills at 0.8125rem. Above 360px all three return, because there the full wordmark fits with room to spare.
- **Size the phone nav for a font you cannot see.** `ui-sans-serif` resolves to a different face on every platform, and the wordmark is the widest thing whose width the site does not control — the same markup that fitted at 320px on macOS wrapped to three rows on Linux, where the mark rendered 11% wider. So row one is built to seat a wordmark wider than the one any single machine renders, and the test that guards it grows the mark 15% — past that delta — and asks whether the cluster is still beside it, rather than asserting a pixel count only the measuring machine would recognise.
- **Theme toggle:** lives in the nav; follows `prefers-color-scheme` by default, persists a manual override. It flips tokens only (The Same Hall Rule).
- **Wordmark:** styled text `WT·RECORDS`, semibold, wide tracking — typography-only branding until identity is finalized.
- **The nav pays for its 44px entirely in reach.** It is already a tenth of the screen once it wraps, so no control here grows: the utility icons sit a gap apart rather than shoulder to shoulder, and the mode pills wear `.tap-reach--low`, hanging their reach into the pane's foot instead of contesting the row above. The pane's own row gap is the one spacing here that answers to width rather than to reach, because whatever sits either side of it is wider than the 44px its reach claims — the wordmark, or a 55px mode pill above `sm`. The cluster's own 14px is the one that cannot move.

### Record Monument (signature)
The mode's all-time high as a lock-screen moment inside the hero: a monumental amber numeral (clamp to ≤6rem) with an engraved plaque line (vehicle · holder · nation), an amber radial glow bleeding through the glass behind it, and the page's only count-up. With zero records it inverts — the count of open titles becomes the feat. This is the page's single amber moment (The One Amber Rule).

### Leaderboard Row (signature)
Rank number right-aligned in a fixed 1.5rem column — faint ink, or the mode's metal forms for 1/2/3 where medals are on — holder name as link, record count pushed to the row's end in muted ink, tabular numerals aligning every row into a ledger.

### Catalog Ledger
The registry's table voice (Browse, /search results): a mid-weight glass pane wrapping the whole table, never per-row cards. Header row in the uppercase muted label register; soft hairline row dividers with the row-hover wash; vehicle names as quiet links (underline on hover only), flag chips beside nations, and the kills column bold in full ink — the number is the hero of every row. Empty ledgers teach: they state what happened and offer "Reset filters" only when filters are active. Pagination continues the nav's pill vocabulary: 10px-radius hairline pills at a thumb's 44px minimum width, the current page in the bright pill-active fill, windowed with ellipses, arrows disabled in faint ink. The head row carries the sort controls, so its own padding is what keeps their reach off the first row rather than over it.

**Every row is illustrated.** The vehicle's silhouette leads the row in a fixed slot (4.75rem wide, narrowing to 3rem when the pane is under 30rem) and the Holder's face closes it — the Avatar when claimed, the Medallion otherwise, since the Medallion is a first-class state and not a gap. Both slots hold their width when the image is missing, so names and numerals keep one edge down the page; a key whose object has gone (a catalog sync can rename one ahead of the asset job) hides its image rather than showing a broken frame.

**The ledger composes, it never shrinks, and it never scrolls sideways.** Nation folds into a flag chip below md; below md the Holder folds onto a second line beneath the vehicle name, and below sm BR folds onto that same line — each keeping the ink of the column it replaces, so one state never speaks in two voices. **Kills stays a column at every width** — it is what the page is scanned for, and its header is the only way to sort by it on a phone; under that header the numeral stays bare, since a unit repeated down every row is noise the header already carries. The name cell is the one that yields (`max-w-0` + `w-full`), truncating under pressure so the table never grows past the viewport. The pane carries no horizontal scroller: one would make it a scrollport and silently pin the sticky head to the pane instead of the viewport.

**The head parks, then pins.** It sticks below the floating nav at a *measured* offset (`--ledger-head-top`, built from the nav's own published `--nav-h`, because the nav wraps and no constant is right at every width). Parked it is part of the glass and carries no fill of its own; pinned it takes the near-opacity `.menu-glass` needs — the pane's fill over an opaque base, so it reads as this pane turning solid rather than a dark band cut into it — because backdrop-filter cannot sample the rows it overlays. Rows reserve the head's own measured height (`--ledger-head-h`) in `scroll-margin-top`, so keyboard focus never lands under it.

### Spotlight (Browse)
The best feats inside the active filter set, above the ledger: the three highest-kill Current records across the *whole* filtered set — not the page, and independent of the ledger's sort — in the record wall's own cards under a ruled section label. It is a summary, so it appears only when it has something to summarise: absent unfiltered (the Mode landing already shows the Mode's best), and otherwise absent unless the filter set holds **at least eight held titles** — the strip shows three, so the threshold is set well above what it displays, making the three visibly a selection rather than a restatement of a set you could take in whole. The count is of *held titles*, never of rows, which open bounties would inflate; the query fetches exactly the threshold, so the candidates it returns are the count. No acquisition tint here, unlike the nation sheet's wall — among three ranked cards a lone gilded pane reads as a medal rather than as premium. Below sm it becomes a snap rail rather than a stack, so the ledger stays on screen.

### Record Card Grid (nation sheets)
The nation sheet's record wall, replacing its ledger table: every title as a small floating glass card (glass-mid material, pane-lift hover) carrying the vehicle name as a quiet link, BR in faint ink, the vehicle-portrait art hovering over the pane, and the record line — kills bold in full ink, holder as link. Two walls share each rank row: the tech tree (auto-fill columns) and Premium & Special (fixed two-column wall at desktop), so a rank rule starts on one baseline across both. Rank rules keep the ledger vocabulary: uppercase rank label, hairline rule fading right, faint "N of M held". Acquisition reads as the card's material — gilded glass for premium, service green for squadron (gradient washes over the glass fill, both modes); event and removed stay neutral glass with their chips. An unheld title renders as an OPEN BOUNTY card: desaturated portrait, the accent-text amber kicker — the page's rationed amber, marking the chase. Empty grids teach like empty ledgers: state what happened, offer "Reset filters" only when filters are active.

### Title Deed (vehicle sheets, signature)
One title stated as a document. A thick-glass pane holds the deed on the left — nation (linking back to that nation's record wall) · class · rank · BR, the vehicle name as h1 with its acquisition chips, then the monument: the kills numeral at `clamp(3.75rem, 8vw, 5.5rem)` in **full ink**, the holder beneath it behind a 32px `PlayerAvatar`, and the provenance line (patch · run BR). The machine takes the pane's bottom-right corner at page scale, bleeding past the padding so the frame's own radius crops it. This is `.title-deed-art`, deliberately **not** `.vehicle-portrait`: the portrait floats on a mask fade, the deed's art runs to the frame, and only the deed's dissolves leftward (above 64rem) so ink never lands on it.

**Every title closes on its bar** — the one number a challenger has to put on the board. Held: `Take this title with N+1 kills in one life — matching the record does not supersede it`, never phrased as "beat N+1", which would demand one more than the title costs. Open: the monument inverts to the class qualifying minimum in accent amber (the page's single amber ink moment) with the bar named rather than restated. A standing record under its own class bar still only has to be exceeded — the qualifying bar gates first claims alone.

**The washes follow the machine, never the ink.** Both the nation's colours (`.flag-wash-sheet`) and the acquisition material (`.acq-pane`) are masked off `--deed-art-h`, the art's height published by the pane, so they pool where the art is and clear the deed entirely — a wash lightens the glass beneath it, and the ink ramp's secondary steps have no contrast margin to spend on a full-pane veil. At sheet scale the flag is blurred into colour: unblurred, its own geometry (the Union Jack's diagonals worst of all) reads as a banner rather than a watermark.

**This is a rule at every scale, and it was only ever applied here.** The record card pools its acquisition material across the art (`.acq-card`, one soft peak rather than a band — a card whose art is missing still has to wear it); the podium's metal tint clears the pane's top band, where the rank line is set in that same metal; and **every** flag wash is blurred, not just the sheet's, because a white stripe is a bright patch under whatever line of type crosses it at any size. Where a pane is ink the whole way down — a standings row — there is no band to pool into, so the material thins instead. Answering the pointer is the same problem again: a hover wash is laid under ink already sitting at its floor, so it is a multiple of a quieter resting wash rather than a fixed brighter one.

### Filter Panel
Catalog filtering lives in one thin-glass instrument panel above the ledger: a fixed 6.5rem uppercase label column (Nation / Class / Rank / BR / Acquisition / Title) with 10px-radius chip rows beside it. Active chips drop their hairline for the bright pill-active fill at constant weight — selection reads as light, not as bold, so nothing shifts. The name search, where a page mounts one, is part of the panel, not separate chrome. On phones the group stack folds behind a "Filters" disclosure carrying an active-count badge; the name search stays visible.

**Density is set by the thumb, not by the type.** The chip grid is where the 44px pitch costs the most room, and it is paid honestly: chips take 8px of vertical padding and a 44px minimum width, rows sit 8px apart, and the reach covers the rest. A single-glyph rank chip is therefore as wide as an eight-glyph one — the ranks read as a scale rather than as ink of eight different sizes, which is the better shape anyway. The BR selects and the name search are the panel's only real 44px boxes, because a form control cannot borrow a pseudo-element's reach. Opened on a phone the panel is nearly a fifth taller for all of it, behind a disclosure a reader has to ask for; folded — the state they meet first — it is eight pixels taller.

### Page Eyebrow
List pages introduce themselves with a mode eyebrow above the h1 — kicker-size (0.6875rem), semibold, uppercase, tracked at the section-label's 0.2em, muted ink: `GRB · GROUND REALISTIC BATTLES`. It is context, never a link, and never amber.

## 6. Do's and Don'ts

### Do:
- **Do** treat the Spatial Scene as first-class: every background ships as `image.jpg` + `image-depth.png` with a static fallback and a reduced-motion path; scenes swap per nation/branch.
- **Do** keep the sandwich intact (The Sandwich Rule): scene → scrim/veil → glass → text, in both modes.
- **Do** flip tokens between modes and nothing else (The Same Hall Rule) — same layout, same spacing, same radii, same rules.
- **Do** keep all numerals tabular (The Tabular Rule) — kills, counts, BRs, percentages.
- **Do** give every glass surface the full material: backdrop blur + saturate, the mode's 1px hairline, Glass Highlight inset top edge, and a band radius (22px card / 26px panel).
- **Do** keep amber ≤10% of any screen and off persistent chrome entirely (The One Amber Rule, The Rationed Colour Rule), using Medal Amber Deep for amber text by day; reserve metals for ranks 1/2/3 (The Earned Metal Rule) with Day Gold/Silver/Bronze as their text-safe day forms.
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
