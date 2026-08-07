# Platform brand policies for the creator-links icon row

Research for [#167](https://github.com/Esk3tit/wt-records/issues/167). Serves the decision in
[#157](https://github.com/Esk3tit/wt-records/issues/157) — creator links render as **full-colour brand
marks, unmodified, each on its own opaque solid chip** — and closes the `[unverified]` gap left by
[#152](https://github.com/Esk3tit/wt-records/issues/152).

Fetched 2026-08-06.

**Evidence grades.** `[P]` = the platform's or publisher's own brand/trademark page or its own published
PDF, fetched directly. `[S]` = a secondary source restating a primary I could not read. Anything I could
not reach is listed under *What stays unverified* rather than inferred.

**Method note.** Several of these blocked a plain fetcher, as #152 found. X's rules turned out to live in
a PDF linked only from the toolkit's legal fine print; Reddit's live in a Lingo SPA; Kick's in a
Brandfolder-hosted PDF behind a domain that 403s every non-interactive client. Those were read with a
real browser (`chrome-devtools-axi`, headed where the headless profile was fingerprinted). TikTok's
brandbook moved hosts mid-redirect. Instagram's icon-level page is broken **on Meta's own site** — that is
a finding, not a fetch failure.

Already settled before this ticket and not re-researched: **YouTube**, **Discord**, **Twitch**.

---

## 1. Summary

| Platform | Unmodified full-colour in a social-links row, no written permission? | Background rule | Clear space | Minimum size |
|---|---|---|---|---|
| **X** | **N/A — there is no full-colour X mark.** "The X logo is black or white." Black-or-white use is published for exactly this purpose, but the guide is addressed "For External Partners" and reserves use to "purposes expressly authorized by X" `[P]` | White on black, or black on white | = the logo's own width, all four sides | not stated |
| **Instagram** | **Yes.** Permission is triggered only by broadcast, radio, OOH, or print larger than A4 `[P]` | **not published on any reachable page** | **not published** | **not published** |
| **TikTok** | **NO — forbidden.** "You may not use the TikTok logos, icons, symbols, or designs without prior written permission." `[P]` | n/a | n/a | n/a |
| **Reddit** | **Yes, and full colour is the stated preference** — but "All commercial use … reserved for Reddit and its licensed partners" `[P]` | icon is self-contained (Snoo always over OrangeRed) | ½ wordmark x-height, **stated for the lockup only** | not stated |
| **Kick** | **No permission clause exists** in the guidelines; the asset hub is open and unauthenticated `[P]` | volt green on **black**, or black on a brand colour; B/W only "when colour is not an option" | = the width of the Special K icon | wordmark 90px digital / 24mm print; Special K 40px / 10mm |
| **Telegram** | **Yes.** "Please feel free to use these Telegram logos … Just make sure people understand you're not representing Telegram officially." `[P]` | none published | none published | none published |
| **Bluesky** *(full-colour gap)* | **Yes.** §4.1 permits the logo "in its official form"; the official forms include Blue and Blue gradient `[P]` | must not be "busy or low-contrast" | = the butterfly logo, all sides | referenced but **never stated** |

**One platform forbids the use outright: TikTok.** Its fallback under #157 is a wordmark — and TikTok
explicitly blesses that fallback, which makes it a clean answer rather than a loss.

**Two platforms constrain the chip's colour, not just its opacity.** X sanctions only a pure-white or
pure-black backing. Kick sanctions only black (or a brand colour with a black mark). Neither can take a
site-wide chip token; #160 needs a per-platform chip colour.

**Reddit is the one open legal question**, and it is about wtrecords.gg's status, not about the mark.

---

## 2. Per-platform detail

### 2.1 X — no full-colour mark exists; black or white only

Primary sources: brand toolkit <https://about.x.com/en/who-we-are/brand-toolkit> `[P]`, and the
**X Brand Quick Guide (For External Partners)**, the PDF the toolkit's legal disclaimer points at:
<https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-brand-guidelines.pdf> `[P]`.
The toolkit page renders no rules — #152's read was right. Everything below is from the PDF.

- **Colour.** "The X logo is black or white. It must be legible and maintain the integrity of its form."
  The question "is unmodified full colour permitted" has no purchase here: X's own primary colours are
  black and white, so the unmodified mark *is* monochrome. Nothing needs recolouring, and nothing may be.
- **Background.** "Logo should be white on black background or black on white background." An exception
  follows for "non-digital or non-monochrome environments": "the logo should be white on darker
  backgrounds and black on lighter backgrounds." A frost pane over a battle scene is neither black nor
  white, so the opaque chip is required here for the same reason YouTube requires it — and the chip must
  itself be black or white.
- **Clear space.** "The empty space around the logo should be at minimum equal width left, right, top,
  bottom." The unit is the logo's own width.
- **Minimum size.** Not stated. The guide says only that the logo "should be large and clear in external
  communications."
- **The handle lockup is the endorsed shape for our exact use case.** The toolkit ships
  "Logo handle lockups … to make it easier for you to show that your account is on X," and the PDF adds:
  "When pairing a username with the X logo, make sure the logo is white or black, and we recommend
  pairing it with the username in black. Observe our clear space rules, and scale the text to [a stated
  %] of the height of the logo. Feel free to use a typeface that's from your brand's design system."
  #157's mark-plus-handle row is exactly this, and X supplies the pattern.
- **Assets.** `x-logo.zip` (X White Logo .png, X Black Logo .png, X Alpha Logo .svg transparent),
  `logo-handle.zip`, `logo-partnership.zip`, `post-layout.zip`, all from the toolkit page, no gate.
  **Both lighting states are published** (white and black).
- **Endorsement disclaimer.** None required. A separate "Logo partnership lockup" exists for asserting a
  partnership, so the plain logo does not assert one.
- **Non-partner use — the ambiguity.** The PDF is titled "For External Partners" and says "reach out to
  your X brand partner if you are looking for something that isn't specifically covered here." Its legal
  section is broader and harsher: "You may use the X brands solely for the purposes expressly authorized
  by X. Strict compliance with these Guidelines is required at all times, and any use of the X brands in
  violation of these Guidelines will automatically terminate any permission related to your use of the X
  brands. X reserves the right to grant or deny any permission at its sole discretion and for any
  reason." Against that: the toolkit is public and ungated, the disclaimer's own trigger is "By using the
  X trademarks and resources on this site, you agree to follow the X Trademark Guidelines," and the
  handle lockup exists to "signpost where your audience can find you." **Read: permitted, but on X's
  revocable sufferance, with no affirmative grant to non-partners anywhere in the document.**
- There is no longer a separate X brand-policy help article — `help.x.com/en/rules-and-policies/x-brand-policy`
  404s. The PDF is the operative document.

### 2.2 Instagram — permitted; the rules that matter are on a page Meta itself has broken

Primary source: <https://www.meta.com/brand/resources/instagram/instagram-brand/> `[P]`.

- **Permission.** "Only those planning to use Instagram's assets in any broadcast, radio, out-of-home
  advertising or print larger than 8.5 x 11 inches (A4 size) need to request permission." A web page is
  none of those. **No permission needed.**
- **The social-row carve-out is explicit.** Under "Distance Instagram from other social networks":
  "Don't mention other social networks in the same spot as Instagram and/or Facebook, **unless it's a
  general 'Follow us on…' call to action.**" A creator-links row is precisely that exception — which
  matters, because absent the carve-out an Instagram glyph sitting beside a YouTube and a Twitch glyph
  would be the prohibited case.
- **Prominence and endorsement.** "Avoid representing the Instagram brand in a way that: Implies
  partnership, sponsorship or endorsement. Makes the Instagram brand the most distinctive or prominent
  feature." No text disclaimer is required; both constraints bear on chip sizing instead.
- **Asset source and terms.** "Anyone using Instagram's assets should only use the logos and screenshots
  found on our Brand Resource Center site and follow these guidelines." The Logo pack downloads from the
  Instagram brand page behind a checkbox reading "I have read and accept the applicable guidelines and
  other terms for use."
- **Variants — verified by opening the pack.** `IG_brand_asset_pack_2023.zip` contains exactly three
  glyphs, in `.ai`/`.svg`/`.png` (black also `.jpg`):
  `Instagram_Glyph_Gradient`, `Instagram_Glyph_White`, `Instagram_Glyph_Black`.
  The full-colour mark is the **gradient** glyph, and **both lighting states are covered** by the
  monochrome pair — though under #157 we ship the gradient in both states.
- **Legal.** "Meta's trademarks are owned by Meta and may only be used as provided in these guidelines or
  with Meta's permission… We may revoke permission to use Meta's trademarks at any time." No partner gate
  for digital use.
- **The gap.** The page defers the whole icon layer — "Be sure to visit the **Brand Elements section** for
  detailed guidelines and to download approved assets" — and that link
  (`facebook.com/brand/resources/instagram/icons`) **301s to a Meta 404 page**. The localised route
  `meta.com/en-gb/brand/resources/instagram/icons/` returns the correct `<title>`
  ("Instagram icon, usage and guidelines") with an **empty body** in a real browser, headed and headless.
  The asset pack ships no guidelines document. So Instagram's clear space, minimum size, background
  requirements, and the gradient-vs-flat-white selection rule are **not published anywhere reachable**.
  See §3.

### 2.3 TikTok — forbidden without prior written permission

Primary sources: TikTok for Developers, Design Guidelines
<https://developers.tiktok.com/doc/getting-started-design-guidelines> `[P]`; and the operative
**TikTok Brand and Use Guidelines** at <https://www.tiktokbrandhub.com/legal> `[P]` (the developer doc
links `tiktokbrandbook.com/d/HhXfjVK1Poj9/legal`, which now redirects to the Brand Hub).

- **The rule, twice, unambiguously.** Developer doc: "You may not use TikTok logos, icons, symbols, or
  designs, without our prior written permission." Brand Hub legal page, as a standalone heading:
  "**You may not use the TikTok logos, icons, symbols, or designs without prior written permission.**"
  And again: "If you have received our prior written permission to use the TikTok logo, the following
  rules apply. **If you have not received our permission, you may not use the TikTok logo.**"
- **The default is permission.** "In most cases, any use of the TikTok brand requires our explicit
  authorization."
- **The wordmark is the sanctioned exception, and it fits #157's fallback exactly.** "However, the TikTok
  word mark can be used to identify or refer to our platform or services without our explicit permission
  (e.g., 'uploaded on TikTok' or **'follow us on TikTok'**). Such use must be fair and in accordance with
  the terms of these guidelines." Wordmark rules: no space between "Tik" and "Tok"; both `T`s uppercase,
  everything else lowercase; do not modify, abbreviate, or translate it.
- **Two wordmark constraints that bind our row.** "Do not use the TikTok brand alongside your brand
  identity, including your brand name, trade name, company name, service name, product name, event name,
  domain name, social media account name, or app name" — so the TikTok wordmark must not be composed into
  a WT Records lockup. And "Do not use any of the TikTok Brand as nouns or verbs." Also: no use "in a
  manner likely to confuse … about … some sort of partnership, sponsorship, affiliation, relationship, or
  endorsement … where actually none exists."
- **Conclusion.** TikTok ships as a **muted-ink wordmark**, not a glyph. This is the cheapest possible
  outcome of the whole ticket: the fallback #157 already designed, and TikTok names it as permitted.
- The logo dos-and-don'ts page (`tiktokbrandhub.com/visual-identity/logo`) governs only permitted users,
  so its clear space and minimum size are moot for us. Not read.

### 2.4 Reddit — full colour is the stated preference for exactly this use; the open question is "commercial"

Primary sources: <https://redditinc.com/brand> `[P]` and the **Reddit Brand System** kit at
<https://redditbrand.lingoapp.com/> `[P]` (a Lingo SPA — read in a browser; `Overview`, `Logo`, `Social`,
`Snoo` sections).

- **The social-sharing rule, verbatim, from the kit's *Social → Share icons* section:**
  "For social sharing, please prioritize use of the primary, **full-color** instance of the Reddit icon.
  However, if the application does not allow for full color, low-color assets may be used to reduce
  definition while maintaining proportions. **Avoid recoloring Reddit icons.**"
  Reddit is the only platform in this set that *prefers* full colour for a social icon row.
- **Off-platform website use is named as an intended use.** From *Share badges*: "Social share badges can
  be used off-platform to drive viewers to content on Reddit… **Usage examples: websites**, ads,
  newspaper articles, YouTube videos, artwork, movie trailers, etc."
- **Background.** No rule aimed at the host surface. The icon is self-contained: "In order to maintain
  consistency, the Snoo head icon should always appear over the brand color OrangeRed, whether it is the
  Conversation Bubble device, other framing shapes, or a full-bleed field of color." A `_FullColor` asset
  already carries its own OrangeRed bubble; `_FullColor_Bleed` fills the frame. The badge do-list adds
  "Emphasize color contrast to help badges stand out" and "Give badges sufficient breathing room to
  improve legibility as well as clickability."
- **Clear space.** Stated **only for the lockup**: "our margin proportions are defined by the scale of the
  wordmark itself, measuring ½ of the wordmark x-height and applying that spacing to the exterior of the
  form." Nothing is stated for the standalone icon, which is what we ship.
- **Minimum size.** Not stated anywhere in the kit.
- **Assets.** The kit is public, no sign-in. *Social → Share icons* publishes five SVGs at 256×256:
  `Reddit_Icon_FullColor`, `Reddit_Icon_FullColor_Bleed`, `Reddit_Icon_2Color`,
  `Reddit_Icon_2Color_FullBleed`, `Reddit_Icon_1Color_Silhouette`. **There is no dark-mode/light-mode
  pair** — the OrangeRed bubble is the constant, and the 1-colour silhouette is the only fallback.
- **Endorsement disclaimer.** None required.
- **The restriction, verbatim, from the kit's Overview:** "**All commercial use of Reddit's brand assets
  and the resources provided in this Kit are reserved for Reddit and its licensed partners.**"
  `redditinc.com/brand` echoes it: "If you would like to use our brand in a commercial project, please
  contact licensing@reddit.com." (`licensing@reddit.com` also handles partner Snoos.)
- **Reading the tension.** The kit both reserves commercial use to licensed partners *and* names websites
  as an intended venue for its off-platform share assets. The honest reading is that "commercial use"
  means using Reddit's marks *in* a commercial offering, not linking to Reddit from a site that has
  revenue — but the kit does not say so. wtrecords.gg is not monetised today; #152 already flagged
  monetisation as a live future (it is why Safe Browsing was rejected). **If the site monetises, Reddit is
  the one platform in this set whose terms plausibly flip**, and the mitigation is one email to
  `licensing@reddit.com`, not a redesign.

### 2.5 Kick — no permission clause anywhere, an open asset hub, and a hard colour rule

Primary source: **KICK Brand Guidelines V2.1, September 2025** (56pp PDF), reached via
<https://about.kick.com/brand> → <https://brandfolder.com/portals/kick> `[P]`.
`kick.com` and `dev.kick.com` return `{"error": "Request blocked by security policy."}` to every client
including a headed real Chrome; `about.kick.com` serves normally to a headed browser only.

- **Two marks.** "PRIMARY LOGO: The KICK wordmark should always be the first choice when representing our
  brand… SECONDARY LOGO: Our secondary logo consists of the letter 'K' from our wordmark, adding
  flexibility to our brand's representation. **When the wordmark cannot be used effectively, always revert
  to the Special K icon.**" An icon row is exactly the case where the wordmark cannot be used effectively,
  so the Special K is the sanctioned choice.
- **Colour — the binding constraint.** "Using our **volt green logo on black** or **black logo on coloured
  backgrounds** should always be the favourite option. Black and white applications should only be used
  printing on certain products, **or when colour is not an option**." Volt Green is `#53FC18`; the palette
  is Volt Green, Iced Out Cyan `#00FFFF`, Bowel Brown `#4C4014`, Black `#000000`, White `#FFFFFF`.
  **A volt-green mark on a white chip is not among the sanctioned combinations**, and a black mark on a
  white chip is a "black and white application," restricted to when colour is not an option — which is
  not our case. **Kick's chip must be black in both of the site's lighting states.**
- **Clear space.** "It must be surrounded by a minimum clear space, free from any other visual elements.
  No graphics should intrude into this area. **The exclusion zone is determined by the width of the
  Special K Icon.**"
- **Minimum size**, stated outright: KICK wordmark — Print 24mm, **Digital 90px**. Special K — Print 10mm,
  **Digital 40px**. Kick is the only platform here that gives a digital pixel floor, and 40px is above the
  glyph size a compact links row would naturally reach for.
- **Misuses (icon).** Do not distort or stretch; do not outline the stroke; do not use non-brand colours;
  icons must be oriented at 90°; do not add effects; ensure high resolution when scaling a PNG; "Always
  reproduce the icon from original artwork files."
- **Assets.** `brandfolder.com/portals/kick` is public and unauthenticated, with separate Wordmarks and
  Icons collections plus the guidelines PDF. **No dark/light variant pair** — the pair is volt-green-on-
  black and black-on-colour, which is a background rule rather than a mode switch.
- **Permission, endorsement, non-partner use.** The 56-page guideline contains **no permission
  requirement, no endorsement disclaimer, and no restriction to partners.** Its stance is the opposite:
  "These guidelines are a set of principles to help inform your decision making. We encourage users to
  embrace the chaos… and break the rules when necessary with purpose." That is an absence of a rule, not
  an affirmative grant — and Kick's own Terms of Service, which is where a trademark clause would live,
  is unreachable (§3).

### 2.6 Telegram — explicitly permitted, with the only disclaimer requirement in the set

Primary source: <https://telegram.org/tour/screenshots> ("Telegram Logos and App Screenshots") `[P]`.

- **The whole policy, verbatim:** "Please feel free to use these Telegram logos for article illustrations,
  graphs, 'forward to Telegram' buttons, etc. **Just make sure people understand you're not representing
  Telegram officially.**"
- **A "forward to Telegram" button is a named permitted use**, and a link-out chip is the same species.
  No permission required, no partner gate.
- **Endorsement.** This is the one platform in the set that attaches a comprehension requirement to the
  mark. It is not a fixed disclaimer string, so it is satisfied by presentation — and #157's design
  already satisfies it: the row is a claimed Player's own self-declared handles, `rel="ugc nofollow"`,
  with the handle rendered beside every mark. Worth recording that the row's "self-declared, not
  endorsed" reading is now a *compliance* property, not only an anti-impersonation one.
- **Assets and variants.** One zip, linked from that page:
  `telegram.org/file/464001088/1/bI7AJLo7oX4.287931.zip/374fe3b0a59dc60005`. Verified contents:
  `Logo.svg`, `Logo.png`, plus `Logo_old.png` / `Logo_old.ai`. **One full-colour mark; no monochrome
  variant, no dark/light pair.** The same blue paper plane serves both lighting states.
- **Background, clear space, minimum size.** **None published.** Telegram publishes no brand guideline
  document at all — no clear space rule, no size floor, no background requirement. Its FAQ has no
  trademark or logo question. `core.telegram.org/api/terms` governs API clients, not link icons, and was
  not treated as controlling here.
- Consequence: Telegram imposes no constraint the chip has to answer beyond the disclaimer reading.

### 2.7 Bluesky — the full-colour gap, closed: permitted

Primary sources: Brand Guidelines <https://bsky.social/about/support/branding> `[P]`,
Trademark Policy <https://bsky.social/about/support/trademarks> `[P]`,
brand assets <https://bsky.social/about/support/icons> `[P]`. Both policies last updated 2026-05-15.

- **Full colour is permitted without permission.** Trademark Policy §4, "Uses That Do Not Require
  Permission," §4.1 *Social media identification*: "Using the Bluesky butterfly logo as a social media
  icon to link to your Bluesky profile **on a website**, business card, email signature, presentation
  slide, or similar material, provided that: (a) **the logo is used in its official form as provided in
  the Bluesky Brand Guidelines**; and (b) the logo functions as a link to your Bluesky profile or, where a
  hyperlink is not possible, appears adjacent to your Bluesky handle." The official forms include the
  blue butterfly, so **full colour clears §4.1**. The Brand Guidelines' own social-icon clause repeats it:
  "You use the official butterfly symbol **or** a standard monochrome (black or white) variant."
- **But Bluesky *prefers* monochrome in exactly our context.** The guidelines' Do list reads: "Use a
  monochrome (black or white) variant **when displaying alongside other social media icons**." This is a
  Do, not a Don't, and §4.1 permits the official form regardless — so full colour is compliant. It is
  worth recording that **no single treatment satisfies both Bluesky's preference and YouTube's rule**:
  YouTube forbids recolouring at all, Bluesky asks for monochrome in mixed rows. #157 resolved this the
  only way it can be resolved, and Bluesky is the platform that pays for it.
- **Background.** Don't list: "**Place the logo on a busy or low-contrast background.**" Together with
  YouTube's "single, solid background color," this is the second of the two rules the opaque chip exists
  to satisfy.
- **Clear space.** "Maintain a clear area around the logo free of other text, images, or design elements.
  **The minimum clear space on all sides is equal to the butterfly logo.** No element should encroach on
  this space."
- **Minimum size.** The Do list says "Maintain the clear space **and minimum size** requirements," but no
  minimum size is stated anywhere in the guidelines. This is a gap in Bluesky's own document, not in this
  research.
- **Assets and variants.** `bsky.social/about/support/icons`, PNG and SVG, no gate: butterfly in **Blue,
  Blue gradient, White, Black** (plus wordmark lockups, pre-composed squares, and banners). **Both
  lighting states published.** A social-icon kit at `/support/icons` is named in the guidelines.
- **Endorsement.** Condition four of the social-icon permission: "The icon does not imply that Bluesky
  endorses you, your content, or your organization." Prohibited use §7.4 restates it. No disclaimer text
  required.
- **Non-partner and commercial use.** §6: "Except for uses permitted under Section 4, all commercial uses
  of Bluesky trademarks require prior written permission." §4.1 is inside that carve-out, **so the social
  icon survives the site monetising** — a materially better position than Reddit's.
- **Sizing constraints that bind the chip.** Guidelines: "Keep your own brand at least as prominent as the
  Bluesky logo." Trademark Policy §8.2: "your own brand, product name, or identity must be displayed at
  least as prominently as the Bluesky mark." Also §7.3 forbids "combining Bluesky logos with other logos,
  icons, or design elements" — an icon *row* is not a combination, but a composed lockup would be.

---

## 3. What stays unverified

Named, not guessed.

1. **Instagram's clear space, minimum size, background requirement, and gradient-vs-flat-white selection
   rule.** Meta's Instagram brand page defers all of it to a "Brand Elements section" whose link
   (`facebook.com/brand/resources/instagram/icons`) **301s to Meta's own 404 page**. The localised route
   `meta.com/en-gb/brand/resources/instagram/icons/` returns the right `<title>` with an empty body in a
   real browser, headed and headless. The official asset pack ships glyphs and no document.
   **Meta's icon guidance is currently unpublished.** #152's `[unverified]` on Instagram is not resolved
   by more effort — it is resolved by Meta fixing the page. Do not substitute Facebook's
   "¼ logo width, min 16px": that figure is from Meta's *Facebook* logo page and nothing states it
   generalises to Instagram.
2. **Kick's Terms of Service trademark clause.** `kick.com/terms-of-service` and `dev.kick.com/terms-of-service`
   return `{"error": "Request blocked by security policy."}` to curl, to headless Chrome, and to headed
   Chrome driven over CDP. Only `about.kick.com` and the Brandfolder hub are reachable. The 56-page brand
   guideline is silent on permission — which is an **absence of a stated requirement, not a grant**. If a
   trademark clause exists, it is in the ToS, and I could not read it.
3. **Whether wtrecords.gg counts as "commercial" under Reddit's kit.** Reddit reserves "all commercial
   use" to licensed partners while simultaneously naming websites as an intended venue for its
   off-platform share assets. Which side a non-monetised fan ledger falls on is not answerable from the
   document.
4. **Whether X's toolkit grants anything to non-partners.** The document is titled "For External
   Partners," directs unanswered questions to "your X brand partner," and reserves use to "purposes
   expressly authorized by X" — yet the toolkit is public and ungated and publishes handle lockups for
   this exact use. There is no affirmative grant to a non-partner anywhere in it. The absence is the
   finding.
5. **Bluesky's minimum size.** Its own Do list requires compliance with a "minimum size requirement" that
   the guidelines never state.
6. **Reddit's clear space and minimum size for the standalone icon.** The kit states margins for the
   *lockup* only (½ wordmark x-height) and no size floor at all.
7. **Telegram's clear space, minimum size, and background rules.** Telegram publishes no brand guideline
   document; there is nothing to be unverified against. `core.telegram.org/api/terms` was not treated as
   controlling for a link icon and was not read in full.
8. **TikTok's logo dos-and-don'ts** (`tiktokbrandhub.com/visual-identity/logo`). Not read: it governs
   parties who hold written permission, which we do not and will not.

---

## 4. What this changes for #157 and #160

- **TikTok ships as a wordmark.** Not a glyph, and not a design compromise — TikTok's own guidelines name
  "follow us on TikTok" as permitted wordmark use. The row is therefore mixed: six marks and one wordmark.
  #157's fallback was the right one to have designed.
- **The opaque chip is now justified by three rules, not one.** YouTube's "single, solid background
  color," Bluesky's "not a busy or low-contrast background," and X's "white on black or black on white."
- **The chip cannot be a single site token.** X sanctions only pure black or pure white behind its mark.
  Kick sanctions only black behind volt green. Reddit and Instagram bring their own colour and want
  contrast. #160 needs a per-platform chip colour, resolved per lighting state.
- **Kick sets a 40px digital floor for the Special K.** That is a real lower bound on the row's glyph size
  and should be checked against the header layout before the row wraps on a phone.
- **Two platforms cap the mark's prominence** — Bluesky ("your own brand … at least as prominently") and
  Instagram ("Makes the Instagram brand the most distinctive or prominent feature" is a don't). A row of
  small chips inside a WT Records profile header satisfies both; a hero-scale mark would not.
- **Telegram's "make sure people understand you're not representing Telegram officially" is satisfied by
  #157's existing posture** — self-declared handles, `rel="ugc nofollow"`, handle rendered beside the mark.
  That posture is now load-bearing for brand compliance too, not only for impersonation.
- **Reddit is the only term that could change under monetisation**, and the remedy is an email to
  `licensing@reddit.com`.

---

## 5. Sources

- X brand toolkit — <https://about.x.com/en/who-we-are/brand-toolkit> **[P, no rules rendered]**
- X Brand Quick Guide (For External Partners), PDF — <https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-brand-guidelines.pdf> **[P]**
- Instagram brand assets and guidelines — <https://www.meta.com/brand/resources/instagram/instagram-brand/> **[P]**
- Instagram Brand Elements / icons — `facebook.com/brand/resources/instagram/icons` **[unreachable — 301s to a Meta 404]**
- `IG_brand_asset_pack_2023.zip` (contents verified) — Meta Brand Resource Center **[P]**
- TikTok for Developers, Design Guidelines — <https://developers.tiktok.com/doc/getting-started-design-guidelines> **[P]**
- TikTok Brand and Use Guidelines (legal) — <https://www.tiktokbrandhub.com/legal> **[P]**
- Reddit brand — <https://redditinc.com/brand> **[P]**
- Reddit Brand System kit (Overview, Logo, Social, Snoo) — <https://redditbrand.lingoapp.com/> **[P]**
- KICK Brand Toolkit — <https://about.kick.com/brand> **[P]**
- KICK Brand Hub — <https://brandfolder.com/portals/kick> **[P]**
- KICK Brand Guidelines V2.1, September 2025, 56pp PDF **[P]**
- Kick Terms of Service — `kick.com/terms-of-service` **[unreachable — blocked by security policy]**
- Telegram Logos and App Screenshots — <https://telegram.org/tour/screenshots> **[P]**
- Telegram logo pack zip (contents verified) — linked from the page above **[P]**
- Bluesky Brand Guidelines — <https://bsky.social/about/support/branding> **[P]**
- Bluesky Trademark Policy — <https://bsky.social/about/support/trademarks> **[P]**
- Bluesky Brand Assets — <https://bsky.social/about/support/icons> **[P]**
