# Country identity on a competitive-gaming profile

Research for issue #151, under map #150 (Profile v2). Verified 2026-08-05. Every number below was
measured or read from the cited primary source in this session unless marked otherwise.

This is a findings document, not a decision. It reports what standards define and what products do.
It deliberately takes no position on any territorial dispute; where a dispute exists it records only
which code exists, who publishes it, and what each product chose.

---

## 0. The one-paragraph answer

Use a **hosted or bundled SVG set keyed by ISO 3166-1 alpha-2**, never emoji. Emoji flags are the
single biggest trap here and the ticket's framing of them needs one correction: on Windows they do
not vanish, they render as the **two-letter region code**. That is worse than blank — it is a
plausible-looking wrong answer that will not show up in a screenshot review done on a Mac. Store the
alpha-2 code, resolve the display name from CLDR at render time (never hardcode country names — the
list rots), make the no-country state the default and a first-class value, and treat the country as
self-declared and unverified, because every peer product does and none of them can do better.

---

## 1. The list: what ISO 3166-1 does and does not contain

### 1.1 The standard's actual contents

`iso.org` is behind a Cloudflare interstitial and could not be fetched directly in this session. The
list itself was read from **Debian's `iso-codes` package**, which is the standard free redistribution
of the ISO 3166 tables and is what most Linux distributions and many libraries derive from:

- Source: <https://salsa.debian.org/iso-codes-team/iso-codes/-/raw/main/data/iso_3166-1.json>
- **249 entries** with an assigned alpha-2 code. This matches ISO's own published figure of 249
  officially assigned alpha-2 codes.

ISO 3166-1's scope is *"codes for the names of countries, dependent territories, and special areas of
geographical interest"* — it is explicitly **not** a list of sovereign states, and assignment is not
a statement of political recognition. Practically: ISO assigns a code where a distinct postal,
statistical or administrative need exists. That is why Antarctica (`AQ`), Bouvet Island (`BV`) and
the Åland Islands (`AX`) are in it.

### 1.2 The entries people argue about, and their exact ISO status

Read from the same file. The **published ISO short name** matters — it is the part that generates
complaints, not the code.

| Code | In ISO 3166-1? | ISO published name | ISO official name |
|---|---|---|---|
| `TW` | Yes | **Taiwan, Province of China** | Taiwan, Province of China |
| `HK` | Yes | Hong Kong | Hong Kong Special Administrative Region of China |
| `MO` | Yes | Macao | Macao Special Administrative Region of China |
| `PS` | Yes | **Palestine, State of** | the State of Palestine |
| `EH` | Yes | Western Sahara | — |
| `AQ` | Yes | Antarctica | — |
| `GB` | Yes | United Kingdom | United Kingdom of Great Britain and Northern Ireland |
| `XK` | **No** | — | — |
| `EU` | **No** (exceptionally reserved) | — | — |
| `UN` | **No** (exceptionally reserved) | — | — |

Three consequences worth internalising:

1. **Kosovo has no ISO 3166-1 code.** `XK` is a *user-assigned* code — ISO 3166-1 reserves ranges
   (`AA`, `QM`–`QZ`, `XA`–`XZ`, `ZZ`) for anyone to use privately, and `XK` became the de facto
   convention. Any product that shows a Kosovo flag has stepped outside ISO deliberately. Unicode
   and CLDR both carry `XK`; the ISO tables do not.
2. **England, Scotland, Wales and Northern Ireland are not ISO 3166-1 entries.** They are ISO 3166-2
   subdivisions of `GB` (`GB-ENG`, `GB-SCT`, `GB-WLS`, `GB-NIR`). Any product showing a St George's
   Cross next to a name has added a second, differently-shaped list on top of ISO. This is one of the
   most-requested features on any esports site and one of the most consistent sources of argument.
3. **ISO's published names are not neutral-sounding.** "Taiwan, Province of China" and "Palestine,
   State of" are ISO's wording. A product that renders ISO's name verbatim in a picker will be read
   as endorsing it. This is precisely why CLDR exists as a display layer (§1.3).

### 1.3 CLDR is the display layer, and it disagrees with ISO on purpose

Unicode CLDR publishes localised territory display names. Measured from
`cldr-localenames-modern@45.0.0`, `main/en/territories.json`
(<https://cdn.jsdelivr.net/npm/cldr-localenames-modern@45.0.0/main/en/territories.json>):

- **315 territory entries** in English, in a **9,997-byte** JSON file (uncompressed). The whole
  English name list is ~10 KB. There is no reason to hardcode names.
- License: **Unicode-3.0** (permissive, redistributable).
- It carries `XK = "Kosovo"`, which ISO does not.
- It carries **`-alt-short`** and **`-alt-variant`** forms, which is the mechanism for sidestepping
  ISO's wording:

| Code | CLDR default | `-alt-short` | `-alt-variant` |
|---|---|---|---|
| `TW` | Taiwan | — | — |
| `HK` | Hong Kong SAR China | Hong Kong | — |
| `PS` | Palestinian Territories | **Palestine** | — |
| `MO` | Macao SAR China | Macao | — |
| `GB` | United Kingdom | UK | — |
| `TR` | **Türkiye** | — | Turkey |
| `CZ` | **Czechia** | — | Czech Republic |
| `SZ` | **Eswatini** | — | Swaziland |
| `MK` | North Macedonia | — | — |
| `CV` | Cape Verde | — | Cabo Verde |

Note CLDR renders `TW` as plain "Taiwan" and offers "Palestine" as the short form. Using CLDR's
`-alt-short` where present is the conventional way products get a neutral-reading label without
inventing their own names.

The rename column is the load-bearing one for maintenance: Türkiye, Czechia, Eswatini, North
Macedonia and Cabo Verde all changed within recent memory. **A hardcoded English name list is a
rot-in-place liability**; a code column plus a CLDR lookup is not.

### 1.4 Data sources, licensed and measured

| Source | License | Size | Has `XK`? | Notes |
|---|---|---|---|---|
| ISO Online Browsing Platform | Viewable free, **not redistributable** | — | No | ISO sells the database. Do not scrape it. |
| Debian `iso-codes` | LGPL-2.1+ | 43,284 B JSON | No | 249 entries, official + common names, many translations. |
| Unicode CLDR (`cldr-localenames-modern`) | Unicode-3.0 | 9,997 B for `en` alone; 19.3 MB for the whole package | **Yes** | The display-name authority. Take only the locales you ship. |
| `i18n-iso-countries` (npm) | MIT | 623,688 B unpacked | Yes | Convenience wrapper, bundles many locales. |

---

## 2. The rendering: verify the Windows claim before anything else

**The ticket says emoji flags "do not render on Windows Chrome at all". That is directionally right
and factually wrong in a way that matters.** They render — as the two regional-indicator letters.

### 2.1 What Unicode actually requires

- **Encoding.** UTS #51 §1.4.5, ED-14: an *emoji flag sequence* is two Regional Indicator characters
  (U+1F1E6–U+1F1FF). Subdivision flags (ED-14a) are tag sequences: U+1F3F4 + tag characters +
  U+E007F CANCEL TAG. <https://www.unicode.org/reports/tr51/#def_emoji_flag_sequence>
- **Display as a flag is NOT required.** UTS #51 §1.5 Conformance makes only the *basic* emoji set's
  display capability mandatory; the RGI flag-sequence set is opt-in. Annex B.1 explicitly blesses the
  fallback: *"Options for presenting an emoji_flag_sequence for which a system does not have a
  specific flag or other glyph include: Display each REGIONAL INDICATOR symbol separately as a letter
  in a dotted square … [or] display the same missing flag glyph."*
  <https://www.unicode.org/reports/tr51/#Flag_Presentation>
- Annex B also notes, quoted: *"Although a pair of REGIONAL INDICATOR symbols is referred to as an
  emoji_flag_sequence, it really represents a specific region, not a specific flag for that region."*
- Unicode's FAQ pushes the question to vendors: *"For concerns about the availability of flag emoji
  on your devices, contact the manufacturer."* <https://unicode.org/faq/emoji_dingbats.html>

**So the letters-instead-of-flag behaviour is conformant.** It is not a bug anyone will fix.

### 2.2 What Unicode's RGI set actually contains

Measured directly from `emoji-sequences.txt`, **Version 17.0, dated 2025-07-25**
(<https://unicode.org/Public/emoji/latest/emoji-sequences.txt>):

- **259** `RGI_Emoji_Flag_Sequence` entries (the file's own `# Total elements: 259`).
- **3** `RGI_Emoji_Tag_Sequence` entries — **England, Scotland, Wales**. **Northern Ireland is not
  RGI and has no emoji flag.** (Verified by grep: no Northern Ireland tag sequence exists.)
- The RGI flag set is *larger* than ISO 3166-1 and includes entries ISO does not assign:
  `XK` Kosovo, `EU` European Union, `UN` United Nations, `EA` Ceuta & Melilla, `IC` Canary Islands,
  `AQ` Antarctica, plus `TW` Taiwan, `HK`, `MO`, `PS` (as "Palestinian Territories").

This is worth noting even if we do not use emoji: **Unicode's list is a third distinct list**, neither
ISO 3166-1 nor CLDR.

### 2.3 The platform matrix (the part that decides the approach)

| Platform | Chrome / Edge / Chromium | Firefox | Safari |
|---|---|---|---|
| **Windows 10 / 11** | **Two letters. No flag.** | **Flags** | n/a |
| macOS | Flags | Flags | Flags |
| iOS / iPadOS | Flags | Flags | Flags |
| Android | Flags | Flags | n/a |
| Linux | Flags iff a colour emoji font with flags is installed | Flags | n/a |
| ChromeOS | Flags | — | — |

Chain of primary evidence:

1. **Segoe UI Emoji has no country-flag glyphs.** Jonathan Kew (Gecko font engineer), Bugzilla
   1970980: *"Segoe UI Emoji does not provide ligatures for the Regional-Indicator codepoints to
   render them as flags, it just renders individual glyphs for each of the characters."*
   <https://bugzilla.mozilla.org/show_bug.cgi?id=1970980>. Also Bugzilla 1692498:
   *"That's simply how Segoe UI Emoji renders the Regional Indicator symbols: it doesn't implement
   flag-glyph ligatures."* <https://bugzilla.mozilla.org/show_bug.cgi?id=1692498>
   Microsoft's own font page documents the font and lists no flag support:
   <https://learn.microsoft.com/en-us/typography/font-list/segoe-ui-emoji>
2. **Windows 11's Fluent emoji redesign did not add them.** Microsoft's own `fluentui-emoji` asset
   repo contains ~1,595 emoji directories and **zero country flags** — the only "flag" assets are
   black / chequered / pirate / rainbow / transgender / triangular / white / crossed flags and
   "flag in hole". Requests have been open since Aug 2022:
   <https://github.com/microsoft/fluentui-emoji/issues/40>
3. **Still true as of Dec 2025.** Microsoft's Dustin Howett, closing
   <https://github.com/microsoft/terminal/issues/19631> as `not_planned` on **2025-12-09**:
   *"The introduction of additional regional indicators of flag tag sequences must be undertaken by
   the folks in Windows who own Geopolitical compliance."*
4. **Chromium ships no emoji font and will not.** `font_fallback_win.cc`'s
   `AvailableColorEmojiFont()` is `{"Segoe UI Emoji", "Segoe UI Symbol"}` —
   <https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/fonts/win/font_fallback_win.cc>.
   Chromium issue **40766658** (ex-`crbug.com/1209677`) was closed **WontFix, 2021-05-21**:
   *"We currently have no plan to ship our own emoji font alongside the browser … Alternatively, the
   website that you're visiting may consider providing an emoji font that has coverage for these
   flags."* (The tracker requires sign-in for anonymous fetch; the quote is attested by two
   independent secondary sources and the WontFix status is consistent with the source code above.)
5. **Firefox on Windows bundles Twemoji Mozilla**, which is why it differs. `browser/fonts/moz.build`
   ships `TwemojiMozilla.ttf` for the `windows` and `gtk` toolkits;
   `gfx/thebes/gfxWindowsPlatform.cpp` orders the Windows emoji fallback as `"Segoe UI Emoji"` then
   `"Twemoji Mozilla"`, so Twemoji catches exactly the flags Segoe lacks. Bundling started in
   **Firefox 50 (2016-11-15)**.

Two extra Windows-Chromium gotchas:

- Subdivision flags (England/Scotland/Wales) degrade to the **bare black flag 🏴**, because the tag
  characters are default-ignorable per UTS #51 Annex C. So `🏴󠁧󠁢󠁳󠁣󠁴󠁿` becomes a black rectangle — a
  worse failure than the two-letter one, and a silent one.
- The two-letter fallback is a *plausible-looking* wrong answer. A design review done on macOS will
  never see it. If we ever ship emoji anywhere, this needs an explicit Windows-Chrome check.

### 2.4 If you wanted emoji anyway: the polyfill route and its cost

- **`country-flag-emoji-polyfill`** (TalkJS): ~0.7 kB JS that feature-detects broken flag rendering
  and loads a **77 kB woff2** COLRv0 "Twemoji Country Flags" subset, prepended to `font-family`.
  <https://github.com/talkjs/country-flag-emoji-polyfill>. Its README states the symptom plainly:
  *"if 🇨🇭 looks like ᴄʜ and not like a flag, then this polyfill is for you."*
- **Noto Color Emoji from Google Fonts**: served as COLRv1 woff2 sliced by `unicode-range`; the
  slice covering `U+1F1E6-1F1FF` (all flags) is **709,628 bytes (~693 KB)** — ~9× the Twemoji subset.
- Upstream `NotoColorEmoji-flagsonly.ttf` is 872 KB (CBDT bitmap); the full CBDT font is 10.7 MB and
  the COLRv1 vector build 5.0 MB. <https://github.com/googlefonts/noto-emoji>
- COLRv1 support: Chrome/Edge 98+, Firefox 107+, **not Safari through 27**
  (<https://caniuse.com/colr-v1>). The 77 kB polyfill font is COLRv0, so it is safe everywhere.

**Verdict: the polyfill works, but it buys nothing an SVG set does not already give us, and it costs
a font load, a feature-detect, and a font that cannot render inside our OG card renderer.** Emoji is
the wrong tool here.

---

## 3. Asset sets, measured

All figures below are real, pulled from the npm registry and the jsDelivr package API in this session.

### 3.1 `flag-icons` (lipis) — the default recommendation

Version **7.5.0**, **MIT**, 552 files, **4,125,978 bytes unpacked** total.

- **271 flags in `flags/4x3/`, totalling 2,001,816 bytes** (~1.91 MB), **average 7,386 B each**.
- An identical 271-flag `flags/1x1/` (square) set, 2,002,505 bytes.
- `css/flag-icons.min.css` is 28,018 B (it inlines every flag as a `background-image` URL — do not
  ship the whole stylesheet if you only need a per-player flag; serve the individual SVGs).
- **Size distribution is wildly skewed and this is the real trap.** Largest: `rs.svg` **181,634 B**
  (Serbia's coat of arms), `sh-ac.svg` 143,373 B, `bo.svg` 102,880 B, `mx.svg` 84,753 B,
  `es.svg` 80,958 B, `sv.svg` 77,273 B. Smallest: `id.svg` **178 B**, `pe.svg` 186 B, `bd.svg` 187 B,
  `at.svg` 195 B. **A single flag can be 1,000× the size of another.** Any "bundle them all inline"
  plan needs to reckon with a 181 KB Serbian flag, and any per-flag budget needs a cap.
- **Coverage beyond ISO**: contains `xk`, `eu`, `un`, `tw`, `hk`, `ps`, `mo`, `aq`, `eh`, all four
  GB subdivisions (`gb-eng`, `gb-nir`, `gb-sct`, `gb-wls`), three Spanish autonomous communities
  (`es-ct` Catalonia, `es-ga` Galicia, `es-pv` Basque Country), Saint Helena dependencies
  (`sh-ac`, `sh-hl`, `sh-ta`), and four supranational bodies (`arab`, `asean`, `cefta`, `eac`).
  **The set is a superset of every list in §1 — so the set does not decide our list. We do.**

### 3.2 Alternatives, measured

| Set | Version | License | Unpacked | Files | Notes |
|---|---|---|---|---|---|
| `flag-icons` | 7.5.0 | MIT | 4,125,978 B | 552 | 271 × 4x3 + 271 × 1x1. No attribution required. |
| `circle-flags` | 2.8.3 | MIT | 564,201 B | 659 | Circular crops. **Far lighter** — ~857 B/file average. |
| `country-flag-icons` | 1.6.20 | MIT | 5,788,269 B | 3,799 | 3x2 + 1x1, ships React components. |
| Twemoji (`jdecked/twemoji`) | — | **Code MIT, graphics CC-BY 4.0** | — | — | **Attribution is required** — a README or footer/About mention is accepted by the project. |
| flagcdn.com / flagpedia.net | — | See below | — | — | Hosted, third-party dependency. |

**`circle-flags` is worth a serious look.** 564 KB for the whole set versus 1.91 MB for
`flag-icons`' 4x3 — because a circular crop discards the emblem-heavy corners that make `rs.svg`
181 KB. It also sidesteps the aspect-ratio problem entirely: circular flags sit next to a circular
avatar without a second rectangle competing with the nation flag chip (§5).

**flagcdn / flagpedia** (<https://flagcdn.com/>): a free Cloudflare-hosted service by Flagpedia,
"includes all 254 country flags, 50 flags of the U.S. states, EU & UN based on vector files from
Wikipedia Commons", offering PNG/WebP/SVG/JPEG, and stating *"we appreciate backlink to
<https://flagpedia.net>"*. The site footer reads "© 2008 - 2026 Flagpedia.net, All Rights Reserved"
— i.e. **there is no explicit open licence grant**, only an informal request for a backlink, and the
`/terms-of-use` page 404s. Treat it as an unlicensed third-party dependency with an availability
risk. Not appropriate for a site that must render its own OG cards server-side.

**Wikimedia Commons directly**: most national flags are public domain, but not all, and the licence
varies per file. Auditing 250 files individually is real work; `flag-icons`' blanket MIT is why it
is the common choice.

### 3.3 Legibility at chip scale

No asset set publishes a minimum-size recommendation. The practical constraints:

- **White-edged flags disappear on a light background.** Japan, Poland, Finland, Cyprus, Israel,
  Georgia all bleed into `daylight-hall` without a border. **This repo already solved this** — see
  §5.
- **Near-identical pairs** are indistinguishable at 16–20 px and stay ambiguous even at 24 px:
  Chad/Romania, Monaco/Indonesia (and Monaco/Poland inverted), Ireland/Côte d'Ivoire,
  Netherlands/Luxembourg, Norway/Iceland, Australia/New Zealand. **A flag alone is never a sufficient
  label** — the country name must be reachable (tooltip, `title`, or adjacent text).
- **Emblem-heavy flags are unreadable at chip scale by construction.** Serbia, Mexico, Bolivia,
  Ecuador, El Salvador, Belize, Croatia, Spain, Portugal, Moldova, Andorra, San Marino, Montenegro,
  Turkmenistan — the coats of arms become a smudge below ~24 px. This is the same reason those files
  are 80–180 KB: we would be shipping 181 KB of detail that renders as three pixels of noise.
  Serving a size-appropriate raster, or accepting the smudge, is a deliberate choice to make.
- **Accessibility**: the flag is decoration when the country name is also present, and should be
  `aria-hidden` in that case; if the flag is the *only* carrier of the country, it needs an accessible
  name. The safest markup pattern is **flag `aria-hidden` + a visible or screen-reader-only country
  name**, which is exactly what the repo's `NationFlag` already does for in-game nations.

---

## 4. What the products actually do

### 4.1 FACEIT

**The list is ISO 3166-1 alpha-2, lowercased.** Verified against FACEIT's own live endpoint,
`https://www.faceit.com/api/users/v1/nicknames/{nickname}`, which returns a `country` field:

| Nickname | `country` |
|---|---|
| `S1mple` | `ua` |
| `ZywOo` | `fr` |
| `dupreeh` | `dk` |
| `device` | `ru` |
| `donk` | `vn` |
| `s1mple-` | `tc` (Turks and Caicos Islands) |

Three things fall straight out of that table:

- The field is a bare lowercase alpha-2 code. There is no custom vocabulary.
- **`tc` and the `device`/`donk` rows are the failure mode, live.** `device` is a Danish player;
  `donk` is Russian. These are impostor or joke accounts carrying a country nobody checked. FACEIT
  performs no verification whatsoever. Turks and Caicos on a top-tier nickname is the "troll country"
  case the ticket asks about, and it is sitting in production right now.
- FACEIT's response also carries a field literally named **`flag`**, whose value is `cs2` / `csgo` —
  it is the *game*, not the country flag. Even FACEIT collides on this word. (Directly relevant: map
  #150 already flags "nation" as an overloaded term in this repo.)

**Interaction.** Self-declared, editable at any time, no verification. FACEIT's support article
"Changing your account's region and country"
(<https://support.faceit.com/hc/en-us/articles/208080469-Changing-your-account-s-region-and-country>)
routes it through account settings → Edit Profile → EDIT → dropdown → SAVE. **Region and country are
two separate settings**: region governs matchmaking; country is the flag. That separation is
deliberate and worth copying conceptually — a player's server region and a player's country are
different facts, and conflating them is a classic bug.

**Country is load-bearing, not cosmetic.** FACEIT's CS2 qualifier system uses country/territory
eligibility derived from rankings
(<https://support.faceit.com/hc/en-us/articles/27611761611420-CS2-Qualifiers-Explainer>). The moment a
self-declared, unverified field gates a prize, it acquires an incentive to lie. **This is the single
most transferable lesson: keep the country decorative, or accept that you now need verification.**

**Rendering.** Not verified — `faceit.com` returns 403 to non-browser clients (Cloudflare) and the
Wayback proxy was rate-limited during this session. What *is* established is that the field is an
alpha-2 code, so any renderer is a lookup on that code; and FACEIT is a Windows-heavy CS2 audience,
which rules out emoji for them as much as for us. **Flagged as an open item** — if it matters,
confirm with a real browser session.

### 4.2 Liquipedia — the most instructive peer, because its list is open source

Liquipedia's flag data is a public Lua module,
`lua/wikis/commons/Flags/MasterData.lua`
(<https://raw.githubusercontent.com/Liquipedia/Lua-Modules/main/lua/wikis/commons/Flags/MasterData.lua>,
49,478 B). Its own header comment documents the composition exactly:

```
-- This table includes:
--   ISO 3166-1 alpha-2
--   ISO 3166-1 alpha-2 User-assigned Code Elements
--   ISO 3166-1 alpha-2 Exceptional Reservations
--   ISO 3166-1 alpha-2 Traditional Reservations
--   ISO 3166-2:GB
--   Other
```

Measured from the file:

- **303 data entries**, **257 two-letter codes**, **88 aliases**.
- Includes `tw`, `hk`, `ps`, `mo`, **`xk`**, `eu`, `un`, `ac`, `gb`.
- The **`ISO 3166-2:GB` section carries all four**: England, Northern Ireland, Scotland, Wales.
  (Note Liquipedia includes Northern Ireland even though Unicode does not — §2.2.)
- The **`Other` section is region pseudo-flags**: Africa, Americas, Arabia, Arab States, Asia,
  Asia-Pacific, Benelux, Central America, Caribbean, Central Asia, CIS, DACH, East Asia, …
  These exist for *teams and tournaments*, not players.
- Each entry carries a **`localised` demonym** alongside the name — e.g.
  `['afghanistan'] = { flag = 'File:af_hd.png', localised = 'Afghan', name = 'Afghanistan' }`.
  Liquipedia renders "Afghan player", not "Afghanistan player". That is a real product detail: a
  demonym reads better in prose than a country name, and CLDR does **not** carry demonyms.
- Rendering is **wiki-hosted PNGs** (`File:xx_hd.png`) served through MediaWiki's thumbnailer — a
  raster set, deliberately, not emoji.

The 88 aliases are the quiet lesson: Liquipedia needs `uk` → `gb`, spelling variants, historical
names and abbreviations to all resolve, because editors type whatever they type. Any picker we build
should search on aliases, not just the canonical name.

### 4.3 Steam

Steam's model is **country + state/province + city**, not a single country field, and it serves
**raster GIFs**, not emoji:

- `https://community.steamstatic.com/public/images/countryflags/us.gif` → HTTP 200, `image/gif`,
  **367 bytes**. A whole 250-flag set at that scale is ~90 KB.
- The country is self-declared in profile settings, freely editable, and shown to anonymous visitors.

Steam is the useful counterexample on *asset weight*: 367 B rasters at a fixed small size beat a
7 KB average SVG when the flag is only ever drawn at one size. Our OG card wants a bigger draw
(§5), so we would need two sizes — but "one tiny raster per flag" is a legitimate answer.

### 4.4 The pattern across peers

Everything checked converges on the same shape:

- **Self-declared, unverified, editable at any time, visible to anonymous visitors.** No product
  checked verifies a player's country. There is no practical mechanism to.
- **ISO 3166-1 alpha-2 as the storage key**, with per-product additions layered on top (GB
  subdivisions and `XK` being the two near-universal additions).
- **Nobody serious ships emoji flags** for the profile flag. The ones that do are the ones with a
  Mac-only design team.
- **The country is a proxy for at least three different things** and products conflate them
  constantly: nationality, country of residence, and matchmaking/server region. FACEIT is unusual in
  splitting region from country explicitly. Liquipedia's editorial position is that a player is listed
  under the country they *represent*, which is a third thing again and needs human adjudication for
  dual nationals — an editorial burden a site with one moderator should not take on.

---

## 5. What this repo already has (PR #79 and after)

This matters more than any external finding, because the decision has to sit next to it.

**`src/components/nation-flag.tsx`** — the in-game **nation** flags (USA, Germany, USSR, Britain,
Japan, China, Italy, France, Sweden, Israel), vendored one-to-one from `wiki.warthunder.com`'s SVGs.
The mechanism:

- All flags live in **one inline SVG sprite**, `NationFlagSprite`, rendered once in `__root.tsx` at
  `width=0 height=0`; every instance is a `<use href="#flag-{slug}">`. The file's own comment gives
  the reason: *"USA alone is ~5KB"* of path data, so it must not be serialised per instance.
- Fixed viewBox `'0 16 100 68'` — new flags must keep the same `y=16..84` field.
- Variants: `chip` (inline beside the nation name) and four `wash` scales (row, pane, hero, sheet)
  used as faint watermarks.
- Every instance is **`aria-hidden="true"`** — the nation name always carries the meaning.
- `hasNationFlag(slug)` exists precisely so callers can fall back when art is missing.

**`.flag-chip` in `src/styles.css:1044`** already encodes the small-size legibility fixes §3.3 warns
about:

```css
.flag-chip {
  display: inline-block;
  width: 1.25em;
  aspect-ratio: var(--flag-aspect);
  vertical-align: -0.09em;
  border-radius: 2px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px var(--hairline-soft);
  flex: none;
}
```

`inset 0 0 0 1px var(--hairline-soft)` **is** the white-edged-flag fix, already shipped. The 2px
radius is locked by DESIGN.md ("2px micro-radius on chip-scale marks (flag chips)").

**DESIGN.md already legislates flag behaviour**, and the rules are about the *nation* flag:

- Ledger rows carry "flag chips beside nations"; below `md` the whole Nation column *folds into a
  flag chip*.
- *"every flag wash is blurred, not just the sheet's, because a white stripe is a bright patch under
  whatever line of type crosses it at any size"* — and at sheet scale the flag is blurred into colour
  because *"unblurred, its own geometry (the Union Jack's diagonals worst of all) reads as a banner
  rather than a watermark."*

### 5.1 The three consequences for a country flag

1. **The sprite mechanism does not scale to 250 countries and must not be reused as-is.** Ten
   hand-vendored nations at ~5 KB of path data each is fine to inline once per document. 250
   `flag-icons` SVGs averaging 7,386 B — with a 181 KB outlier — is ~1.9 MB of inline SVG in every
   HTML response. **A country flag has to be a per-player asset request (or a per-player inline of
   exactly one flag), not a document sprite.** This is the single clearest technical conclusion.
2. **The visual vocabulary is already spoken for, and collision is the real risk.** Map #150 names it:
   *"the site already owns nation for in-game nations … A real-world country flag is a second flag on
   the same page."* A `/player/$slug` page can plausibly show a German in-game nation flag chip on a
   record row and a German country flag next to the player's name — **the same rectangle, twice,
   meaning two different things**. Options that create separation:
   - **Different shape**: `circle-flags` for country, rectangle for nation. Also 564 KB vs 1.91 MB
     (§3.2), and it echoes the circular avatar. Strongest candidate.
   - **Different placement**: country locked to the identity cluster (avatar/name/badges), nation
     locked to record and vehicle contexts. Necessary regardless, not sufficient alone.
   - **Explicit reuse**: same chip treatment for both, accepting the ambiguity. Cheapest, and the
     one most likely to be regretted.
3. **`.flag-chip`'s ring and 2px radius should be inherited whichever way it goes** — they are the
   already-proven answer to the white-flag-on-light-background bug, and diverging would reintroduce a
   solved problem.

### 5.2 The OG card constraint

`src/og/render/art.ts` pre-fetches remote art **out of band**, with a documented reason:

> *"A failed image fetch INSIDE the renderer crashes the whole render, so resolve remote art here,
> out of band: any miss → null → the card renders art-less."*

It applies a 3,500 ms timeout and a 4 MB streamed byte cap.

So a country flag on the share card must be **either bundled locally** (read from disk / imported at
build time, no network) **or routed through the same pre-fetch path with the same null-fallback**.
A third-party CDN (flagcdn) is the worst option here: an outage would either blank the flag or, if
wired naively, take the whole card down. **Bundling the ~250 SVGs server-side and inlining the one
needed is the safe shape** — it costs disk, not response weight, since only one flag is ever
serialised per card.

---

## 6. Failure modes, collected

1. **Windows Chrome renders emoji flags as two letters** — conformant, unfixable, invisible in a
   macOS design review. §2.
2. **Subdivision emoji flags degrade to a bare black rectangle** on Windows Chrome. §2.3.
3. **Self-declared country is trivially false**, and it is false in production on FACEIT today
   (`device` → `ru`, `donk` → `vn`, `s1mple-` → `tc`). §4.1.
4. **The moment a country gates anything — a leaderboard, eligibility, a prize — it acquires an
   incentive to lie**, and the field stops being cosmetic. §4.1.
5. **ISO's published names read as political statements** ("Taiwan, Province of China"; "Palestine,
   State of"). Rendering them verbatim is itself a choice. CLDR's `-alt-short` exists for this. §1.2,
   §1.3.
6. **Country names rot.** Türkiye, Czechia, Eswatini, North Macedonia, Cabo Verde all renamed. A
   hardcoded English list will be wrong within a few years. §1.3.
7. **Kosovo, and the GB subdivisions, are the two omissions users complain about most**, and both
   require stepping outside ISO 3166-1 deliberately. Whatever is chosen, it should be chosen on the
   record rather than falling out of a library default. §1.2.
8. **Flags are ambiguous at chip scale** — Chad/Romania, Ireland/Côte d'Ivoire, Monaco/Indonesia,
   Netherlands/Luxembourg. The name must always be reachable. §3.3.
9. **Emblem-heavy flags are 80–180 KB of detail that renders as a smudge**; Serbia alone is 181,634 B.
   §3.1.
10. **Nation vs country is a live word- and shape-collision on our own pages.** FACEIT hit the same
    collision in its own API, where `flag` means the game. §4.1, §5.1.
11. **A hosted flag CDN is an unlicensed third-party dependency.** flagcdn offers no explicit licence
    grant, only "we appreciate backlink", and its terms page 404s. §3.2.
12. **Nationality / residence / server region get conflated.** FACEIT splits region from country
    deliberately; Liquipedia adjudicates "represents" editorially, which needs humans we don't have.
    §4.4.

---

## 7. Open items not established here

- **FACEIT's actual flag asset** (SVG vs sprite vs raster, and pixel size) — `faceit.com` is
  Cloudflare-gated against non-browser clients and Wayback was rate-limited. Needs a real browser
  session if it matters. The *list* question is fully answered (§4.1); only the rendering is open.
- **ESEA, op.gg, start.gg, HLTV, Challengermode, Battlefy** were not individually inspected in this
  session. Liquipedia and Steam were, and FACEIT's list is confirmed; the pattern in §4.4 is drawn
  from those three plus the general convergence, not from an exhaustive survey.
- **`circle-flags`' exact coverage of `XK` / GB subdivisions / `EU`** was not enumerated file-by-file
  (only its total: 659 files, 564,201 B, MIT). If circular is chosen, enumerate before committing.
- **Whether a "prefer not to say" state is the signup default** on FACEIT — the support article covers
  changing it, not the initial state.
- **ISO's own count and scope wording** could not be read from `iso.org` directly (Cloudflare 403);
  249 is corroborated by Debian's `iso-codes` redistribution rather than quoted from ISO.

---

## 8. Sources

**Standards and data**
- UTS #51, Unicode Emoji — <https://www.unicode.org/reports/tr51/>
  (§1.4.5 ED-14, §1.5 Conformance, Annex B, Annex B.1, Annex C)
- `emoji-sequences.txt` v17.0, 2025-07-25 — <https://unicode.org/Public/emoji/latest/emoji-sequences.txt>
- Unicode emoji FAQ — <https://unicode.org/faq/emoji_dingbats.html>
- CLDR `cldr-localenames-modern@45.0.0`, `main/en/territories.json` (Unicode-3.0) —
  <https://cdn.jsdelivr.net/npm/cldr-localenames-modern@45.0.0/main/en/territories.json>
- Debian `iso-codes`, `data/iso_3166-1.json` (LGPL-2.1+) —
  <https://salsa.debian.org/iso-codes-team/iso-codes/-/raw/main/data/iso_3166-1.json>
- ISO 3166 landing page (403 to non-browser clients) — <https://www.iso.org/iso-3166-country-codes.html>

**Platform / rendering**
- Bugzilla 1970980, Jonathan Kew on Segoe UI Emoji ligatures —
  <https://bugzilla.mozilla.org/show_bug.cgi?id=1970980>
- Bugzilla 1692498, same, and Firefox's bundled-font behaviour —
  <https://bugzilla.mozilla.org/show_bug.cgi?id=1692498>
- Microsoft Segoe UI Emoji font page —
  <https://learn.microsoft.com/en-us/typography/font-list/segoe-ui-emoji>
- `microsoft/fluentui-emoji` issue #40, open since Aug 2022 —
  <https://github.com/microsoft/fluentui-emoji/issues/40>
- `microsoft/terminal` #19631, closed not_planned 2025-12-09 —
  <https://github.com/microsoft/terminal/issues/19631>
- Chromium `font_fallback_win.cc` —
  <https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/fonts/win/font_fallback_win.cc>
- Chromium issue 40766658 (WontFix, 2021-05-21) — <https://issues.chromium.org/issues/40766658>
- Firefox `browser/fonts/moz.build` —
  <https://github.com/mozilla-firefox/firefox/blob/main/browser/fonts/moz.build>
- `mozilla/twemoji-colr` — <https://github.com/mozilla/twemoji-colr>
- caniuse COLRv1 — <https://caniuse.com/colr-v1>
- `country-flag-emoji-polyfill` — <https://github.com/talkjs/country-flag-emoji-polyfill>
- `googlefonts/noto-emoji` — <https://github.com/googlefonts/noto-emoji>

**Assets**
- `flag-icons` — <https://github.com/lipis/flag-icons>; metrics from
  <https://registry.npmjs.org/flag-icons/latest> and
  <https://data.jsdelivr.com/v1/packages/npm/flag-icons@7.5.0?structure=flat>
- `circle-flags` — <https://github.com/HatScripts/circle-flags>, npm metadata
- `country-flag-icons` — npm metadata
- `jdecked/twemoji` README, licence split — <https://github.com/jdecked/twemoji>
- flagcdn — <https://flagcdn.com/>; flagpedia terms page 404 — <https://flagpedia.net/terms-of-use>

**Products**
- FACEIT nickname API (live, unauthenticated) —
  `https://www.faceit.com/api/users/v1/nicknames/{nickname}`
- FACEIT, "Changing your account's region and country" —
  <https://support.faceit.com/hc/en-us/articles/208080469-Changing-your-account-s-region-and-country>
- FACEIT, "CS2 Qualifiers Explainer" —
  <https://support.faceit.com/hc/en-us/articles/27611761611420-CS2-Qualifiers-Explainer>
- Liquipedia `Module:Flags/MasterData` —
  <https://raw.githubusercontent.com/Liquipedia/Lua-Modules/main/lua/wikis/commons/Flags/MasterData.lua>
- Steam flag asset — `https://community.steamstatic.com/public/images/countryflags/us.gif`

**This repo**
- `src/components/nation-flag.tsx`, `src/styles.css:1044`, `src/og/render/art.ts`, `DESIGN.md`
