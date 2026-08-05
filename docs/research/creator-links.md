# Creator links: the candidate set, per-platform mechanics, and the safety layer

Research for [#152](https://github.com/Esk3tit/wt-records/issues/152), a child of the Profile v2 map ([#150](https://github.com/Esk3tit/wt-records/issues/150)).
Answers: which platforms a Content Creator should be able to link, what a correct link to each looks like, and what has to be true for publishing user-supplied outbound links to be safe.

This is research, not a decision. Nothing here is implemented.

**Evidence grades used throughout.** **[P]** = the platform's or publisher's own documentation, fetched. **[S]** = secondary source restating a primary document I could not fetch (several brand sites are JS shells or 403 to non-browser clients). **[R]** = this repository. Anything unverified is called unverified rather than smoothed over.

---

## 0. The one-paragraph answer

Ship **five** links: **YouTube, Twitch, Discord, X, and one free-form personal site** — with TikTok as a defensible sixth and everything else below the tail. Store a **handle**, not a URL, for every platform that has one, and construct the URL server-side; the only stored URL is the personal site, and it is the only field that needs moderation. The safety work that actually matters is not `rel="noopener"` (browsers already imply it) but **path-shape validation**, because an allowlist of hosts alone still lets an attacker route a visitor through `youtube.com/redirect?q=` to anywhere on the internet — and handle-only storage closes that hole by construction rather than by filtering. The finding that changes the *design*, not the schema: **YouTube and Discord both forbid recolouring their marks outright, and YouTube additionally requires its icon sit on "a single, solid background color"** — which our signature translucent glass over a parallaxing battle scene is not. A monochrome brand-icon row is therefore not licensable. Use **muted-ink wordmarks** instead.

---

## 1. The candidate set

### 1.1 The strongest evidence is the publisher's own program

Gaijin runs a Content Partnership program, and its acceptance criteria are a ranked, quantified statement of which platforms matter for *this exact audience*, written by the party with the most data about it. From the live partnership page **[P]**:

| Platform | Threshold to be accepted as a War Thunder partner |
|---|---|
| YouTube | at least **1,000 subscribers**, plus 1,000 views on long-form *or* 5,000 views on short-form |
| Twitch | at least **500 followers**, plus **20 average viewers** |
| TikTok | at least **25,000 followers**, plus 10,000 views |

Source: <https://warthunder.com/en/media/partnership> **[P]**

Three things fall out of this, and they are the backbone of the ranking:

1. **Only three platforms are accepted at all.** Not Instagram, not Reddit, not a personal site. The publisher's own creator funnel is YouTube + Twitch + TikTok.
2. **The thresholds encode relative worth.** A creator qualifies on TikTok at 25,000 followers but on YouTube at 1,000 — a **25×** bar. Gaijin is saying a TikTok follower is worth a small fraction of a YouTube subscriber in this niche. Twitch's bar is *lower* than YouTube's in raw count (500) but is qualified by **20 average concurrent viewers**, which is a live-audience test with no YouTube equivalent — Twitch is being measured as a different kind of thing, not a smaller one.
3. **An older invitation article listed different platforms and thresholds** — YouTube 3,000 / Twitch 2,000 / Facebook or Twitter 50,000 (<https://warthunder.com/en/news/3365-news-media-partnership-invitation-to-youtubers-streamers-content-creators-en>) **[P]**. The current page has **dropped Facebook and Twitter entirely** and added TikTok. That drift is itself a finding: the social tier is volatile, the video tier is not. Anything we hard-code should be the stable part.

Also from the same page **[P]**: the application requires **"Proof of channel ownership"**. The niche's own gatekeeper already treats ownership proof as a required, human-reviewed step — see §5 and §6.3.

### 1.2 What comparable products enumerate

**Liquipedia player infoboxes** are the best available enumeration of "what an esports player links", because the parameter list is a schema, publicly documented, evolved over a decade across many games. Across wikis **[S]** (search-surfaced; the template pages 403 to non-browser fetches):

| Wiki | Link parameters offered |
|---|---|
| Counter-Strike | twitch, facebook, twitter, instagram, youtube, reddit, vk, tencent, weibo, steam |
| StarCraft II | **discord**, twitter, twitch, youtube, facebook, instagram, afreeca, azubu, douyu, hitbox |
| Dota 2 | twitch, youtube, twitter, facebook, instagram, weibo, tencent, vk |
| Overwatch | tlstream, twitch, youtube, twitter, facebook, instagram |
| Teamfight Tactics | instagram, twitter, twitch, vk, youtube, steam |
| Team Fortress | tlstream, twitch, azubu, youtube, twitter, facebook, weibo, tencent, gplus |

Sources: `liquipedia.net/<wiki>/Template:Infobox_player` **[S]**

Read the intersection, not the union. **Twitch, YouTube, and Twitter appear in every one.** Instagram and Facebook appear in most. Steam in some. **Discord in exactly one.** Everything else is either regional (vk, weibo, tencent, douyu, afreeca) or a dead platform still carried for old pages (azubu, hitbox, gplus) — a useful warning that a link schema accumulates corpses, and an argument for a short list you are willing to remove from.

Two structural observations matter more than the list:

- **Liquipedia stores handles, not URLs.** The parameters are `twitch=<name>`, `youtube=<name>`; the template builds the URL. A mature, adversarial, high-traffic UGC wiki chose handle-storage. §3.
- **Liquipedia is editorially moderated.** Its impersonation defence is not a validator, it is a human. §6.3.

**Discord's own Connections list** is a second useful enumeration — the platforms Discord itself considers identity-bearing enough to display on a profile (Battle.net, Bluesky, eBay, Epic Games, Facebook, GitHub, Instagram, League of Legends, PayPal, PlayStation Network, Reddit, Riot Games, Roblox, Spotify, Steam, TikTok, Twitch, X, Xbox, YouTube, and others). Unverified against Discord's support docs in this pass — treat as directional. **[unverified]**

**Twitch** offers creators a "Social links" feature on the channel page, and historically the free-form "About panel". **YouTube** offers channel "Links" — a free-form title + URL list surfaced on the channel page. Both are **free-form URL** models rather than picked-platform models, which is the opposite of what I recommend here; the difference is that Twitch and YouTube own the abuse and reputation risk of their own platform at a scale that funds a trust-and-safety org, and we do not. **[unverified in this pass — feature existence is well known, exact current limits not fetched]**

### 1.3 War Thunder specifics

The community skews to **long-form YouTube and live Twitch**, and the evidence is convergent rather than anecdotal:

- Gaijin's partner criteria explicitly separate **"long-form content"** from **"short-form content"** and set a 5× higher view bar on short-form **[P]** — the publisher is pricing short-form as worth one fifth of long-form, view for view.
- The creators the community names are YouTube-first channels in the hundreds of thousands of subscribers: PhlyDaily, The Mighty Jingles, BaronVonGamez, Squire, MagzTV, The Iron Armenian, Bo Time Gaming, DEFYN, Ec0ke, theOrangeDoom **[S]**. These are long-form vehicle-review and gameplay channels, several with a paired Twitch presence. Per-creator link inventories were not individually scraped in this pass — this is the weakest link in the chain and is flagged as such. **[unverified]**
- **Discord punches above its weight here and the ranking should say so.** It is the *rarest* parameter across Liquipedia infoboxes, yet: this project's own history is a Discord-moderated records sheet, Discord is one of the site's two OAuth providers **[R]**, and PRODUCT.md records that historical proof lived in "Imgur and Discord links" **[R]**. In this niche a Discord server *is* the community, not a side channel. A generic social list would rank Discord below Instagram; for War Thunder that would be wrong.
- **Steam is real but weak.** War Thunder is on Steam, and Steam profile links appear on some Liquipedia wikis, but a Steam profile is an account page, not a creator surface — nobody grows an audience on it. It also carries the worst URL-stability story of any candidate (§2). It belongs in the tail.
- **Reddit** (r/Warthunder) is where the community argues, but individual creators rarely publish a Reddit profile as a channel. Tail.
- **The official War Thunder forum profile** and stat sites (thunderskill and similar) are game-specific surfaces that recur in this niche and in no generic social list. They are the interesting tail candidates — but they are *stat* identities, not *creator* identities, and this feature is Content Creator links. Out.

### 1.4 The ranking, and where the tail begins

**Tier 1 — ship these.** Every creator in this niche has at least one.
1. **YouTube** — the niche's primary medium; the publisher's lowest bar; long-form is what War Thunder content *is*.
2. **Twitch** — the live half of the same audience; the publisher measures it with its own metric.

**Tier 2 — ship these; they earn their slot on this niche's shape, not on general popularity.**
3. **Discord** (server invite) — the community's actual home; weakly supported by generic peers, strongly by this domain.
4. **X** — still the default short-text channel for patch-day reaction and clip-sharing; universal across every Liquipedia wiki. Ship it knowing the publisher dropped it from partner criteria.
5. **Personal site** — one free-form field. Not a platform; the escape hatch that stops the list from needing to grow. It is also the only field with real risk (§7).

**The tail begins at #6.** Everything below is a platform some creators have and few use as their creator channel, and each one added costs a brand-asset licence review, a validator, an icon, a row of profile chrome, and a permanent migration obligation when the platform changes its URL scheme — against a marginal gain that is close to zero for a site whose subject is a records ledger, not a creator directory.

**Tier 3 — defensible sixth, not recommended first.**
6. **TikTok** — the only tail platform with primary-source backing in this exact niche (Gaijin accepts it), but at a 25× threshold, and its short-form format is what the publisher discounts 5:1.

**Below the tail — do not ship.** Instagram, Reddit, Steam, Patreon, Facebook, Bluesky, Kick, Ko-fi, Telegram, Mastodon, GitHub, Linktree, Rumble/Odysee. Two of these deserve a note rather than silence:
- **Patreon / Ko-fi** are monetisation, not audience. If they are ever wanted, they are a different feature ("support this creator") with a different tone, and putting them in a social row makes the ledger look like it takes a cut.
- **Linktree** is the tail's own solution to the tail. If a creator has eight platforms, their personal-site field is a Linktree, and the list never needs to grow. This is the strongest argument that five is enough.

---

## 2. Per-platform mechanics

Canonical URL shapes and handle grammar. Handle regexes below are **derived from the documented rules** and are a starting point for validation, not quotes.

### YouTube **[P]**

- **Canonical URL:** `https://www.youtube.com/@<handle>`. YouTube documents four live forms — handle `youtube.com/@youtubecreators`, channel-ID `youtube.com/channel/UC…`, legacy custom `youtube.com/c/Name` (**"New custom URLs can no longer be set up or changed"**), and legacy user `youtube.com/user/Name`. YouTube does not use the word "canonical", but the handle URL **"is created automatically whenever you choose or change your handle"** — every channel has one, so it is the only form that is both universal and current.
  <https://support.google.com/youtube/answer/6180214>
- **Handle grammar:** **"is between 3-30 characters"** (Han/Hangul 1–10; Ethiopic/Hiragana/Katakana 2–20; mixed-script varies). **"Uses alphabet letters or numbers from one of our 75 supported languages"**, and **"can also include underscores (_), hyphens (-), periods (.), Latin middle dots (·), but not at the beginning or end"**. **"Handles aren't case-sensitive."** The `@` is a URL prefix, not part of the handle — store without it.
  <https://support.google.com/youtube/answer/11585688>
- **Derived regex (ASCII subset):** `^(?=.{3,30}$)[A-Za-z0-9][A-Za-z0-9._\-·]*[A-Za-z0-9]$`. Note the doc permits non-Latin scripts with *different* length bounds — an ASCII-only regex will reject legitimate handles. Either accept Unicode letters or accept that a Japanese-script creator cannot be linked.
- **Handle reclamation — primary source, and it settles §6.3:** YouTube Help states **"each channel can only have one handle… YouTube reserves the right to change, reclaim, or remove a handle at any time."** **[P]** A stored `@AceGunner` can therefore come to point at a different channel with our site's credibility attached.
- **Stable opaque ID:** the channel ID (`UC…`), exposed by the YouTube Data API — which also offers `channels.list?forHandle=` to resolve a handle to an ID server-side, and `channels.list?mine=true` on an OAuth'd request as direct ownership proof. Handles are mutable; channel IDs are not.
- **Storage:** **handle** (+ channel ID if we ever call the API). A handle change silently 404s a stored handle, which is loud and correctable; a channel ID never breaks but is unreadable and cannot be typed by a user.

### Twitch **[P] / [S]**

- **Canonical URL:** `https://www.twitch.tv/<login>`. Flat namespace, no prefix.
- **Handle grammar:** **at least 4 characters** **[S]**; the widely-applied rule is 4–25 characters, `[a-zA-Z0-9_]`, case-insensitive (the login is lowercase; a separate *display name* carries capitalisation and, per Twitch's localised-display-names feature, can be a non-Latin script entirely). Length ceiling and character set are **[unverified]** against a primary Twitch page in this pass — `help.twitch.tv/s/article/how-to-change-your-username` 404s to non-browser clients.
- **Rename behaviour — this is the important one.** Twitch's Username Transfer Policy **[S]**: a user may change username **once every 60 days**; **"Your channel URL will not redirect to your new name"**; and for **Partners** the old username **is not released to anyone else**. The unstated converse — that a *non-Partner's* old username re-enters the pool — is the impersonation vector in §6.3, and it is **[unverified]** and worth confirming before relying on it either way.
  <https://link.twitch.tv/UsernamePolicy>
- **Derived regex:** `^[A-Za-z0-9_]{4,25}$`.
- **Stable opaque ID:** numeric user ID from Helix `GET https://api.twitch.tv/helix/users?login=<login>`, which **"Requires an app access token or user access token"** and **no scopes** **[P]** — i.e. a plain client-credentials token resolves a login to a permanent ID for free.
  <https://dev.twitch.tv/docs/api/reference/>
- **Storage:** **handle + numeric ID**, if we ever want rename-survival. Handle alone is fine for v1.

### Discord **[P] / [S]**

Two different things share the name, and conflating them is a real modelling error.

- **A server invite** — `https://discord.gg/<code>` (equivalently `https://discord.com/invite/<code>`). This is what a creator actually wants to publish. The code is an opaque short string, or a vanity code for boosted servers. Invites **can expire, be revoked, or be deleted**, and a deleted vanity code can be claimed by another server — so a stored invite decays.
- **A user profile** — `https://discord.com/users/<snowflake>`. Useless on a public page: it opens the Discord client, and most users cannot be DM'd by a stranger.
- **Username grammar (post-2023 migration)** **[S]**: **2–32 characters**, **forced lowercase**, limited to **`a-z`, `0-9`, `_` and `.`**, and **cannot contain two consecutive periods**. Display name is separate and unconstrained. Discord's own guidelines note usernames **"must adhere to our Community Guidelines, which prohibit usernames used for impersonation"**.
  <https://support.discord.com/hc/en-us/articles/12620128861463-New-Usernames-Display-Names>, <https://discord.com/blog/usernames/>
- **Derived regex (username):** `^(?!.*\.\.)[a-z0-9_.]{2,32}$`.
- **Storage:** for the invite, **store the code** and construct `https://discord.gg/<code>`. This is strictly better than storing the URL: it makes `discord.gg` unforgeable, and it makes the `discord.com/invite/` alias a normalisation step rather than a second allowlist entry.
- **The migration is the cautionary tale.** Discord changed its entire username grammar across the whole userbase in 2023. Any schema that assumed the old `Name#1234` shape broke. Store the narrowest thing that is still reconstructible.

### X (Twitter) **[P] / [S]**

- **Canonical URL:** `https://x.com/<handle>`. `twitter.com/<handle>` still resolves and should be normalised to `x.com`, not allowlisted as a second host.
- **Handle grammar** **[S]**: **"cannot be longer than 15 characters"**; **"can contain only letters, numbers, and underscores"**; no spaces; **usernames containing "X" or "Admin" cannot be claimed**. Case-insensitive. `help.x.com` 403s to non-browser fetches, so this is search-surfaced from X's own help pages rather than fetched.
  <https://help.x.com/en/managing-your-account/x-username-rules>
- **Derived regex:** `^[A-Za-z0-9_]{1,15}$`.
- **Handle recycling** **[S]**: **"The username may be claimed by a suspended or deactivated account"** and **"deactivating an account will not immediately free up the username"** — i.e. handles do return to the pool. Same impersonation decay as Twitch.
- **Storage:** **handle**. There is a stable numeric user ID, but the API is now paid, so we cannot cheaply resolve it. Handle-only, and accept the decay.

### Steam **[S]** — tail, documented for completeness

- **Two URL forms:** `https://steamcommunity.com/id/<vanity>` and `https://steamcommunity.com/profiles/<steamid64>`. Visiting the SteamID64 form **redirects to the vanity URL** when one is set.
- **The stability story is the worst of any candidate** **[S]**: a user **"can change their custom URL as many times as they want"**, and **"anywhere that a custom profile URL has been posted, those links will be broken or will redirect to whichever user claims the previous URL. Only Steam ID64 remains permanent."** A stored vanity URL does not merely rot — it can silently come to point at a *different person*. If Steam is ever shipped, store the **SteamID64**, never the vanity.
- Steam is also the host of the `linkfilter` open redirect — §6.2.

### TikTok **[unverified]** — defensible sixth

- **Canonical URL:** `https://www.tiktok.com/@<username>`.
- Grammar (commonly 2–24, `a-z0-9._`, no trailing period, case-insensitive) could **not** be confirmed from a TikTok primary source in this pass; `tiktok.com/legal/page/global/brand-guidelines/en` returns a JS shell with no content. Do not encode a TikTok regex from memory.

### Personal site

- **No canonical shape.** Any `https:` origin. This is the field that carries essentially all of the risk in this feature and none of the platform mechanics; see §7.

---

## 3. Handle vs URL — store the handle

**Recommendation: store a bare handle (or invite code) per platform, and construct the URL server-side from a per-platform template. Store a URL for exactly one field, the personal site.**

What each choice costs:

| | Store handle, construct URL | Store URL |
|---|---|---|
| Platform changes URL scheme | one template edit, zero rows touched (YouTube `/c/` → `/@`, `twitter.com` → `x.com`) | a data migration over every row, forever |
| Open-redirect abuse via the platform's own endpoint (§6.2) | **impossible by construction** — there is no slot for a path or query | possible unless path-shape validation is exhaustive and stays correct |
| Attacker links somewhere hostile | cannot — the URL space is `https://host/<handle>` | the entire point of validation |
| Scheme smuggling (`javascript:`, `data:`) | impossible — scheme is ours | must be rejected explicitly |
| Host confusion (`youtube.com@evil.com`, `youtube.com.evil.com`) | impossible — host is ours | must parse, never string-match |
| Renders as text next to the icon | free — the handle *is* the label | must be derived by parsing, and can be spoofed |
| User pastes a full URL into the field | needs a paste-normaliser (they will paste a URL; accept it and extract) | works |
| Deep links (a specific video, a Steam group) | not expressible | expressible |
| Migration cost if we later want URLs | low | n/a |

Handle storage is the same choice Liquipedia made, and the reason is the third row of that table: **it removes an entire vulnerability class rather than defending against it.** A validator can be wrong; a template with one substitution slot cannot route a visitor off-platform.

Two consequences worth writing into the spec:

- **Accept a pasted URL in the input and normalise it to a handle.** Every user will paste `https://www.youtube.com/@Name`. Rejecting that is hostile. Parse it, confirm the host is the expected one, extract the handle, store the handle, and *show them* the handle you stored.
- **The handle is the accessible label.** Render "YouTube · @PhlyDaily", not a bare icon. This also solves the brand-asset problem in §4 and the a11y problem in §6.1 at the same time.

---

## 4. Brand assets and licensing — the constraint that changes the design

This is not a footnote. Taken together the guidelines make the obvious design — *a row of small monochrome brand glyphs in muted ink* — **not licensable**.

### 4.1 What the platforms actually say

| Platform | Recolour / monochrome | Clear space & size | Other binding rules | Grade |
|---|---|---|---|---|
| **YouTube** | **Forbidden.** "You **cannot modify the colors** of the YouTube logos or YouTube Icons and should present those images **on a single, solid background color** that complements the overall creative or surrounding." Only the separate *"developed with YouTube"* logo may be recoloured, and then "as long as the logo content is in one single color". | "Ensure that there is sufficient contrast between the logo and the background." Icon assets for "a panel of links to social media sites" are provided on the brand site. | "You must **never use the YouTube name or any abbreviation, acronym, or variant** … such as YT or You-Tube **in conjunction with the overall name of your application**" — a *product-name* rule, not a link-label rule. Also: "You cannot change YouTube branding images or remove, obstruct, distort, or alter any element of a YouTube trademark." | **[P]** |
| **Discord** | **Forbidden.** "Please do not **edit, change, distort, recolor,** or reconfigure the Discord logo." | Discord publishes a Clearspace section; the numeric ratio is stated diagrammatically and was not extractable from the fetched page. | Full brand kit behind a Corebook link. | **[P]** |
| **Twitch** | **Monochrome permitted, but only in Twitch's three colours.** "Twitch logos are always a single color, and can only be used in **black, white, and Twitch Purple**. Black should be used as the default on light backgrounds, and white on dark backgrounds." | Not captured. | "Don't alter, add, distort, cut off, redraw, or change into an outline" and "don't add embellishments, such as glows, drop shadows, gradients, textures, patterns". Official assets: `brand.twitch.tv` → `Twitch-Brand.zip`. | **[S]**, asset URL **[P]** |
| **X** | Not captured — `about.x.com/en/who-we-are/brand-toolkit` renders the logo as an inline SVG with no accompanying rules in the fetched HTML. X's historical position permits black/white. | Not captured. | — | **[unverified]** |
| **Bluesky** | **Explicitly permitted, and the model everyone else should copy.** "You do **not need permission** to use the Bluesky butterfly as a social media icon, provided that: (1) You use the official butterfly symbol **or a standard monochrome (black or white) variant**; (2) The icon **links to your Bluesky profile**; (3) The icon is **sized consistently with other social media icons** displayed alongside it; (4) The icon **does not imply that Bluesky endorses** you." Don't: "**Recolor the logo** (other than the approved black and white variants)", add "drop shadows, gradients, outlines, or glows", or "place the logo on a **busy or low-contrast background**". | "The minimum clear space on all sides is **equal to the butterfly logo**." | — | **[P]** |
| **Facebook / Meta** | Primary is Facebook Blue; **secondary is white with a transparent 'f'** — so white-on-brand or white-over-imagery is sanctioned. | "Clear space is defined by taking the width of our logo and **dividing it by four**." Minimum size **16px wide** digital, 6mm print. | "DON'T design your own logo word mark"; "Do not use drop shadows or effects on the logo." | **[P]** |
| **Patreon** | Not stated in the fetched guidelines. | Not stated. | Prohibits incorporating the marks into your own brand name, altering the logo, merchandise use without written agreement, and sub-licensing. Use restricted to "digital only capacity (for example, on your website, social media…)". Directs specification questions to `brand@patreon.com`. | **[P]** |
| **Instagram** | Not obtainable — the Meta brand page defers to a "Brand Elements section" that did not render. | — | "Only use logos and screenshots found on our Brand Resource Center site." | **[unverified]** |
| **TikTok** | Not obtainable — brand-guidelines page is a JS shell. | — | — | **[unverified]** |
| **Reddit** | Not obtainable — `redditinc.com` blocks the fetcher. | — | — | **[unverified]** |

### 4.2 Why this collides with this site specifically

DESIGN.md **[R]** puts three rules in the way:

- **The One Amber Rule** — Medal Amber "does two jobs": marks the registry at work, and carries the primary action. It "never dresses a surface that is merely present". A social link is neither a feat nor a commit. **Amber is out.**
- **The Earned Metal Rule** — metals "color only ranks 1, 2, and 3 — never headings, **never icons**, never decoration." **Metals are out.**
- The hall is deliberately **chroma-neutral** — the overview names "purple→blue gradients" and "gray-on-color text" among the templated looks it explicitly rejects.

So the system leaves exactly one legitimate treatment for a social row: **muted monochrome ink on glass**. And that is precisely what YouTube and Discord forbid.

Worse, YouTube's rule is not only about the mark. **"present those images on a single, solid background color"** — our panes are translucent frost over a depth-parallaxing battle scene that swaps per nation. That is the definition of a background that is neither single nor solid. Bluesky's "do not place the logo on a **busy or low-contrast background**" says the same thing in different words. **Our signature material is itself the violation**, independent of colour.

### 4.3 Simple Icons does not launder this **[P]**

The usual escape hatch is Simple Icons — a CC0 set of single-colour brand glyphs, `npm install simple-icons`. Its own disclaimer closes the hatch:

> "Simple Icons is released under CC0 - **though that doesn't mean to imply that all icons within the project are also CC0.**"
> "Simple Icons **cannot be held responsible** for any legal activity raised by a brand, or users of the package. We ask that our users **seek the correct permissions** to use the icons relevant to their project."

<https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md>

The package licence covers the *packaging*, not the marks. Each icon object even carries its own `license` field, and the README warns the data can change between releases. Using Simple Icons to render a monochrome YouTube glyph is doing the exact thing YouTube's guidelines forbid, with an extra step. It changes nothing legally.

Note also **[R]**: the repo's only icon dependency is `lucide-react` (0.545.0), and Lucide deliberately ships **no** brand marks. There is no in-repo brand-icon source today, so this is a greenfield decision rather than a migration.

### 4.4 The design consequence

**Do not build a brand-icon row. Build a wordmark row.**

Render each link as **text**: the platform name in the muted-ink label register, plus the handle. "YouTube · @PhlyDaily". "Twitch · phlydaily". "Discord · Join server".

Why this is the right answer and not a retreat:

- **It moots every logo guideline at once.** None of the rules above govern the *word*. Using a platform's name truthfully to identify where a link goes is nominative use; it is what YouTube's own guidance contemplates when it permits "a great app for YouTube" phrasing, and it is only the *product-naming* case that is forbidden. No recolouring question arises because there is no mark.
- **It is already the site's voice.** DESIGN.md's nav section reasons the same way in reverse — it argues a *word* costs more than an icon in a cluster of anonymous utility controls. Here the inverse holds: these are named destinations, and the name is the information. The site's wordmark is text-only for the same reason (branding is not finalised **[R]**).
- **It carries the handle, which is the anti-impersonation signal.** A row of five glyphs tells a visitor nothing about *whose* channel it is. "YouTube · @PhlyDaily" lets them check. §6.3.
- **It is accessible for free.** No icon needs an `aria-label`; no glyph needs to survive 320px; the link text is already the accessible name.
- **It survives a platform being dropped.** Removing a wordmark is deleting a string.

If a mark is ever wanted, the only two currently defensible options are **Twitch** (black/white explicitly permitted) and **Bluesky** (monochrome explicitly permitted, with four written conditions we would meet). Both are outside Tier 1 or below the tail. That asymmetry — the platforms that permit monochrome are the ones we care least about — is the finding.

---

## 5. Verification affordances — fact only

Verification is **not** being built here. Recording what exists, because it constrains what a later ticket can do.

**The strongest pattern found is bidirectional `rel="me"`, and it beats a "put this code in your bio" scheme because it needs no state on our side.** Mastodon documents the mechanic **[P]** (<https://docs.joinmastodon.org/user/profile/>):

> "Document-based verification and blue ticks are not possible without a central authority. However, Mastodon can cross-reference the links you put on your profile to prove that you are the real owner of those links… If you put an HTTPS link in your profile metadata, Mastodon checks if that link resolves to a web page that **links back to your Mastodon profile with a special `rel=me` attribute**. If so, you get a verification checkmark next to that link."

Why the *bidirectionality* is the whole point: a one-way link proves nothing — anyone can link to anyone. A reciprocal `rel="me"` proves the person holds **write access to both endpoints**. Impersonation then requires compromising the real creator's channel, at which point the link is arguably true. It converts "I claim to be PhlyDaily" into "I can edit PhlyDaily's channel description." Corroborated by IndieWeb's rel-me/RelMeAuth (<https://indieweb.org/rel-me>) and microformats.org, which lists Mastodon, GitHub, MediaWiki's `RealMe`, and Threads as implementers — **and both of our closest analogues already emit the `me` half today** (§6.1). Adjacent: Bluesky handles are DNS/`.well-known`-proven domains (<https://atproto.com/specs/handle>), and Google Search Console's ownership verification is **re-checked periodically, not one-shot** (<https://support.google.com/webmasters/answer/9008080>) — which is precisely the property that defends against handle recycling.

| Platform | Affordance | Cost / gate |
|---|---|---|
| **Discord** | OAuth2 with the **`connections`** scope returns the user's linked third-party accounts — including, for many users, their YouTube, Twitch, Steam, Reddit and X connections. **This is unusually powerful for us**: Discord is *already* one of the site's two OAuth providers **[R]**, so a single additional scope could verify several platforms at once. Requires re-consent. **[unverified — scope name and payload not re-confirmed in this pass]** | Free; existing provider |
| **Twitch** | Twitch OIDC/OAuth identifies the account directly. Separately, Helix `GET /helix/users?login=` resolves a login to a permanent numeric ID with only an app token and **no scopes** **[P]** — enough to *pin* a handle, not to prove ownership. | Free; app registration |
| **YouTube** | Google OAuth with a YouTube Data API scope returns the authenticated user's own channel — direct proof of ownership. Alternatively the classic **"put this code in your channel description"** pattern, since descriptions are publicly readable via the Data API. | Free tier with a daily quota; Google project |
| **X** | OAuth 2.0 exists, but the API is now paid at every meaningful tier. The bio-code pattern requires reading a profile, which is also gated. | Effectively paid |
| **Steam** | **Steam OpenID** is free, ancient, stable, and proves SteamID64 ownership outright. | Free |
| **Bluesky** | Handles can be **DNS-verified domains** — a creator whose handle *is* their domain has already proven control of it. | Free, inherent |
| **Personal site** | `rel="me"` / IndieAuth: the site links back to the profile, and mutual `rel="me"` links establish control. Also a `/.well-known` file. | Free |
| **The niche's own precedent** | Gaijin's partner application requires **"Proof of channel ownership"** and a human reviews it **[P]**. The domain's incumbent gatekeeper solved this with a moderator, not an API. | Free; one moderator |

The pattern worth carrying forward: **the cheapest verification we could ever build is already sitting in our login provider.** A Discord `connections` read would cover Twitch/YouTube/Steam/X/Reddit in one consent, for free, without a single bio-code flow — if the scope behaves as documented, which needs confirming.

---

## 6. The safety layer

### 6.1 `rel` and `target`

**The reverse-tabnabbing question is settled and is no longer the interesting one.** Per MDN **[P]**:

> "Setting `target="_blank"` on `<a>`, `<area>` and `<form>` elements **implicitly provides the same `rel` behavior as setting `rel="noopener"`** which does not set `window.opener`."

<https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener>

Specced in WHATWG HTML PR [#4330](https://github.com/whatwg/html/pull/4330) and shipped in **Chrome 88** (MDN browser-compat-data, `implicit_noopener: 88`), **Firefox 79** (release notes, bug 1522083), and **WebKit** via Safari Technology Preview 68, Oct 2018 → stable in Safari 12.1 (<https://webkit.org/blog/8475/release-notes-for-safari-technology-preview-68/>; the Safari 12.1 notes themselves do not mention it, so cite STP 68). **[P]**

OWASP's own updated framing is the honest one: *"Links that use `target="_blank"` now have implicit `rel="noopener"` in modern browsers, so this vulnerability isn't as widespread and critical as before… there are still some browsers out there that doesn't support it, so please consider your userbase"* (<https://owasp.org/www-community/attacks/Reverse_Tabnabbing>) **[P]**.

So `noopener` is default in every browser this site supports. Writing it explicitly buys legacy coverage, lint-rule satisfaction, and explicitness — not security. Write it anyway (nine characters) but do not treat it as the mitigation. One genuine non-redundancy: per MDN, *"when `noopener` is used, nonempty target names other than `_top`, `_self`, and `_parent` are all treated like `_blank`"*. And one audience-specific reason it is not purely academic — **War Thunder players click links from Steam's in-client CEF browser and Discord's embedded webview**, which lag desktop Chrome.

**`noreferrer` is a real product decision, and the current repo default is probably wrong for this feature.** Today every outbound link in the codebase uses `rel="noreferrer"` with no `noopener` and no `ugc` — `src/components/proof-gallery.tsx:61-62`, `src/routes/admin/records/$id.tsx:374,390,460,470` **[R]**. That is correct for *proof* links (third-party image hosts we have no relationship with). It is **wrong for creator links**: `noreferrer` strips the `Referer` header, so a creator gets no attribution for traffic we send them. Sending referral credit to a creator whose page we are hosting is the entire social contract of the feature. Prefer `referrerpolicy="strict-origin-when-cross-origin"` — the platform gets `https://wtrecords.gg` as the source without leaking which player's page, and `noopener` is unaffected.

**`ugc` is the one that is actually missing.** Google Search Central **[P]**:

> "We recommend marking user-generated content (UGC) links, such as comments and forum posts, with the `ugc` value."
> Multiple values are allowed: "You may specify multiple `rel` values as a space- or comma-separated list" — e.g. `rel="ugc nofollow"`.

<https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links>

Creator links are the textbook `ugc` case. Without it we are passing PageRank to arbitrary user-chosen destinations, which is what makes a profile system worth farming in the first place. Google's own note points at the graduated model: "If you want to recognize and reward trustworthy contributors, you might remove this attribute from links posted by members or users who have consistently made high-quality contributions over time" — which maps exactly onto *Content Creator status is moderator-granted*. A CC application already is the trust gate; `ugc` on everything is still the right default, and dropping it for approved creators is a deliberate later choice, not an oversight.

**How the closest analogues actually mark this up** — verified by fetching live public profiles and parsing the anchors **[P — direct observation]**:

| Site | Observed markup on a user-published link |
|---|---|
| **GitHub** (profile website + socials) | `rel="nofollow me"` |
| **itch.io** | `rel="nofollow me"` on the free website field; bare `rel="me"` on Mastodon/Bluesky/Twitter socials; `referrerpolicy="origin"` on outbound |
| **Linktree** | `rel="nofollow noopener noreferrer" target="_blank"` |

**None of them use `ugc`** — they all use `nofollow`. But the GitHub/itch.io split is the single most useful piece of prior art here: **`nofollow me` on the untrusted free-form website, bare `me` on the identity-bearing socials.** The `me` half is not decoration — it is a verification primitive (§5).

**Recommended:** `rel="ugc nofollow noopener"` + `referrerpolicy="origin"` (which sends `https://wtrecords.gg/` — the creator gets attributed to us, and the specific profile URL, which carries a player's identity, is not leaked; itch.io ships exactly this). Drop `nofollow` for moderator-verified creators, which is the escape hatch Google itself documents. Use `target="_blank"` **with** a visible external-link glyph whose accessible name says "opens in new tab" — WCAG **G200** advises against new windows generally and **G201** requires advance warning when you do use them; note SC 3.2.5 is **Level AAA**, so a silent `_blank` is an advisory concern, not an A/AA failure. MDN's pattern puts the announcement in the glyph's `alt` so it survives image failure: `<img src="new-tab.svg" alt="(Opens in new tab)">`.

### 6.2 Open redirects through allowlisted hosts — the subtle one

**Allowlisting a host is not enough, because the allowlisted host will redirect for you.**

**Every endpoint below was tested live** (curl with a desktop UA against the redirector pointed at a sentinel host, recording status + `Location` + body) rather than taken from folklore. **[P — direct observation]**

| Endpoint | Result | Abusable from a host-only allowlist? |
|---|---|---|
| `www.youtube.com/redirect?q=<url>` | **HTTP 200 interstitial** — "Are you sure you want to leave YouTube? … (evil.example.com)". **No token required.** | ✅ **yes**, one click-through |
| `youtube.com/redirect?q=<url>` (apex) | HTTP 301 → `www.` form, query preserved | ✅ yes |
| `steamcommunity.com/linkfilter/?url=<url>` | **HTTP 200 interstitial** — Valve's warning mascot, "leaving Steam.", attacker URL echoed | ✅ **yes**, one click-through |
| `store.steampowered.com/linkfilter/?url=` | HTTP 302 → store home — rejects | ❌ no |
| `www.google.com/url?q=<url>` | HTTP 200 "Redirect Notice" interstitial | ✅ yes |
| **`www.tiktok.com/link/v2?aid=1988&scene=bio_url&target=<url>`** | **HTTP 302, `Location: <url>` — SILENT, no interstitial** | 🔴 **yes — fully silent. The worst case.** |
| `out.reddit.com/r/…?url=` | 302 → reddit home — signature-gated | ❌ no |
| `reddit.com/r/…/s/<slug>` | 307 → subreddit; slug is server-minted | ❌ no |
| `l.facebook.com/l.php?u=` | HTTP 400 — requires valid `h=` hash | ❌ no |
| `bing.com/ck/a?…&u=` | HTTP 204 on forged `u` — signature-gated | ❌ no |
| `linkedin.com/redir/redirect?url=` | HTTP 200 "Link Error" — `urlhash` gated | ❌ no |
| `t.co/<slug>` | 404 for arbitrary slugs — opaque, minted via API | ❌ no |
| `x.com/i/redirect?url=` | HTTP 400 | ❌ no |
| `t.me/iv?url=` | 200, renders Instant View — not a navigation | ❌ no (but see below) |
| `discord.com/login?redirect_to=` / `oauth2/authorize?redirect_uri=` | 200; `redirect_uri` must be pre-registered | ❌ no |
| `twitch.tv/login?redirect_path=` | 200, no redirect | ❌ no |
| `youtube.com/attribution_link?u=` | 404 — retired | ❌ no |

**Correction to the folklore.** Published writeups describe YouTube's `/redirect` as firing *"instantly … with no warning, no interstitial, and no friction"* **[S]** (<https://cybertamarin.medium.com/how-i-found-an-open-redirect-in-youtubes-redirect-link-cyber-tamarin-0cf2ddfedcdd>, <https://untrustednetwork.net/en/2019/07/22/half-open-redirect-vulnerability-in-youtube/>). **That is no longer true** — it now serves an interstitial. It still takes an *unauthenticated, unsigned* `q`, so it remains abusable; it just costs the attacker one click. Google has warned about this abuse pattern in its own Search blog **[S]** (<https://developers.google.com/search/blog/2009/01/open-redirect-urls-is-your-site-being>). Also note `t.me/<bot>?start=<payload>` hands attacker-controlled payloads to the Telegram *client* rather than the browser — same class, different delivery.

**Three of the platforms you would most want to allowlist ship a working redirector on the allowlisted host.** And for our audience the interstitials make it *worse*, not better: a victim clicks a link on a War Thunder records site, lands on a **steamcommunity.com-branded page bearing Valve's warning mascot**, and is then delivered to a fake Steam login. The interstitial does not warn them — it **legitimises** the destination, because it renders under Valve's own domain and chrome. TikTok's needs no click at all.

The lesson generalises past the specific endpoints: **any host large enough to be worth allowlisting is large enough to have a redirector.** A host allowlist is a *necessary* control that is not a *sufficient* one.

**Mitigations, in order of strength:**

1. **Store handles, not URLs (§3).** The URL space becomes `https://www.youtube.com/@<handle>` where `<handle>` is regex-constrained and cannot contain `/` or `?`. `youtube.com/redirect?q=` is not expressible. This is the mitigation; everything below is for the personal-site field only.
2. **Parse, never string-match.** Every classic bypass below was run through Node's WHATWG `URL` (the same algorithm browsers use, <https://url.spec.whatwg.org/>) and these are the **measured** results **[P — direct observation]**:

   | input | parsed `hostname` | note |
   |---|---|---|
   | `https://youtube.com@evil.com/x` | `evil.com` | userinfo — *reads* as YouTube to a human |
   | `https://youtube.com:80@evil.com` | `evil.com` | colon reads as password delimiter |
   | `https://evil.com/youtube.com` | `evil.com` | substring match damns you |
   | `https://youtube.com.evil.com/` | `youtube.com.evil.com` | **defeats `endsWith('youtube.com')`** |
   | `https://уoutube.com/` (Cyrillic у) | `xn--outube-vrf.com` | parser punycodes it for you |
   | `http://youtube.com./` | `youtube.com.` | **trailing dot is a valid FQDN and breaks `Set.has()`** |
   | `HTTPS://YOUTUBE.COM/@x` | `youtube.com` | parser case-normalises for you |
   | `https://youtube.com\@evil.com` | `youtube.com` | backslash is *not* a userinfo delimiter |
   | `javascript:alert(1)` / `data:…` / `vbscript:…` | `""` | **parse fine with an empty host** — a `hostname !== 'evil.com'` check passes them |

   So: compare `url.hostname` by **exact equality** against a Set (which also kills the homograph for free, since the punycoded form simply is not in the Set), **strip one trailing dot** first, and **reject any URL with a non-empty `username` or `password`** — you never want to render that string to a user anyway. The repo already learned the parse-don't-regex half once: `src/admin/api.ts:182` carries the comment *"A prefix regex admits host-less values like `https://?x`; parse instead."* **[R]**
3. **Validate the path shape, not just the host — and the single highest-leverage rule is to reject any query string outright.** Measured side by side, a host-only check accepts **7** hostile inputs (all three platform redirectors, plus `?utm_source=`, a port, a fragment, and a double-encoded path); adding path-shape validation accepts **zero**. Every one of the three redirectors carries its payload in the query, and **every legitimate creator profile URL is query-free.** One rule, three vulnerabilities closed. Also reject a port, a fragment, and anything not matching a per-platform path regex (`^/@[A-Za-z0-9._-]{3,30}$`, `^/channel/UC[A-Za-z0-9_-]{22}$`, `^/id/[A-Za-z0-9_-]{2,32}/?$`, `^/profiles/7656\d{13}/?$`).
4. **Scheme allowlist of exactly `https:`.** Rejects `javascript:`, `data:`, `vbscript:`, and `http:` — and note from the table above that those schemes *parse successfully*, so a host check alone lets them through. `src/auth/profile.ts:61` already does exactly this for avatar seeds **[R]**. See also OWASP's HTML5 cheat sheet on the `javascript:`/`data:` sink class.
5. **Render `url.hostname`, not the user's string.** The parser has already punycoded it, so a homograph domain renders as visibly ugly `xn--…` rather than as a convincing lookalike.
6. **Canonicalise before validating, and store the reassembled canonical form** — never the raw input. This is what kills double-encoding: `%2e%2e/redirect%3Fq=` stays inside `pathname` and never becomes a query.

OWASP's guidance backs the handle-storage choice directly **[P]**:

> "Where possible, have the user provide **short name, ID or token which is mapped server-side to a full target URL**. This provides **the highest degree of protection** against the attack tampering with the URL."
> "Sanitize input by creating a list of trusted URLs (lists of hosts or a regex). This should be based on an **allow-list** approach, rather than a denylist."
> "Force all redirects to first go through a page notifying users that they are going off of your site, with the destination clearly displayed, and have them click a link to confirm."

<https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html>

That first bullet is a one-line endorsement of §3. Note the third bullet describes an interstitial — see §6.4 for why I would not build one.

### 6.3 Impersonation

**The threat.** A user claims a Player, gets Content Creator status, and links the *real* PhlyDaily YouTube channel. Nothing is technically invalid: the URL is well-formed, the host is allowlisted, the destination is safe. The lie is the association, and no validator can see it.

Three compounding factors:

- **Handle recycling makes a once-true link false later.** X: "The username may be claimed by a suspended or deactivated account" **[S]**. Twitch releases non-Partner usernames **[unverified]**. Steam is worst — a changed vanity URL means old links "**redirect to whichever user claims the previous URL**" **[S]**. So even a *verified* link can silently come to point at a stranger. Verification is a snapshot, not a property.
- **This site's badge amplifies it.** #150 specifies a CC badge "on every surface that renders a player's name" — ~15 components **[R]**. An impersonator does not get one bad profile page; they get a site-wide endorsement.
- **A records ledger is a high-value target for exactly this.** The whole point of the site is authority about who did what.

**What comparable products do:**

- **Liquipedia** — editorial moderation. Anyone can edit; a human reverts. The defence is a person, not a rule.
- **Gaijin's own partner program** — requires **"Proof of channel ownership"** with human review **[P]**. Directly on point, same audience.
- **Discord** — handles it at the *policy* layer: usernames "must adhere to our Community Guidelines, which prohibit usernames used for **impersonation**" **[S]**. Enforcement is reports plus staff.
- **Twitch's** answer is the verified/Partner mark — the platform vouches, the link does not.
- **This repo already made this exact call once** and got it right. CONTEXT.md **[R]**: *"Claims are never self-serve (impersonation of known holders is one click otherwise)"*. The Claim flow is moderator-gated for precisely this reason. **Creator links inherit that argument wholesale** — they are a strictly stronger impersonation vector than a claim, because a claim asserts identity within our namespace while a link asserts identity within someone else's.

**Mitigations, in order:**

1. **The CC status is the gate.** #150 already specifies a moderator-reviewed application. Links exist only behind it. This is the single highest-value control and it is already in the plan.
2. **Show the handle, never a bare icon (§4.4).** "YouTube · @PhlyDaily" is falsifiable by any visitor in one glance. A row of five glyphs is not.
3. **Uniqueness constraint: one platform account → one Player.** A unique index on `(platform, handle_normalised)` makes the second person to claim a channel collide with the first instead of quietly coexisting. Cheap, and it converts a silent duplicate into a moderator signal. Note it needs a case- and dot-normalised form to be meaningful.
4. **Re-review on edit.** A link changed after approval re-enters the queue. Otherwise CC status is a one-time key to an unreviewed field, which is the same hole `OwnerAvatarControls` has today **[R]**.
5. **A report affordance.** Impersonation is discovered by the impersonated, and they will not have an account here.

### 6.4 Malicious links, malware, and scams

**The niche-specific threat is real, evidenced, and our audience is precisely the target demographic.** Three concrete patterns:

- **The Steam API-key / trade scam.** A phishing page shows a **fake "Login with Steam" button**, harvests username, password and the 2FA code, then creates a **Steam Web API key** on the victim's account — which lets the attacker programmatically cancel and re-route the victim's trade offers to a lookalike account. Steam accounts have **no** API key by default and do not need one to trade, so its mere presence is the indicator of compromise. Documented in guides on Steam's own platform (`steamcommunity.com/sharedfiles/filedetails/?id=1408053055`, `…id=2926756889`) and Steam support (<https://help.steampowered.com/en/faqs/view/76D0-06A1-0B3C-D426>) **[P]**. **The delivery vehicle is a typosquat** — `steamcomunnity.com` for `steamcommunity.com`. This is decisive for our design: **a strict host allowlist defeats the entire typosquat class outright**, because the lookalike domain simply is not in the Set. That one control neutralises the dominant scam in our demographic.
- **Discord "free Nitro" / token stealers.** Fake gift links lead to credential phishing or info-stealers that exfiltrate Discord tokens, browser passwords and wallets. The genuine domains are **`discord.gift`** and **`discord.com/gifts`**; `discordgift.com` and friends are phishing. One documented campaign **specifically targets Steam gamers**, promising Nitro for linking a Steam account and then stealing game items. Discord's own guidance: <https://support.discord.com/hc/en-us/articles/4407571667351-Scams-Spam-and-Phishing> **[P]**; campaign reporting via BleepingComputer/Bitdefender **[S]**.
- **"Free Golden Eagles" generators — the exact War Thunder variant.** Golden Eagles are the game's premium currency and, not incidentally, what Gaijin pays partners in **[P]** — so a CC badge over a "free GE" link is a credibility-laundering machine. **The strongest evidence is the live search-result set itself:** `wiki.physics.wisc.edu/lz/index.php/(FREE_METHOD)_FREE_War_Thunder_Golden_Eagles_GENERATOR_2023…` and `glycan.mit.edu/CFGparadigms/index.php/…War_Thunder_Free_Golden_Eagles…` — **two university MediaWiki instances that allowed user-published pages with links and were colonised into War Thunder GE spam farms.** That is our exact threat model, on our exact keyword space, already happening to sites that made this feature without `ugc`/`nofollow` and without review. (No official Gaijin advisory could be reached — `help.gaijin.net` fails DNS. **[unverified]**)

**Available controls:**

- **Google Safe Browsing** — **"There is no cost for use of this API"** **[P]** (<https://developers.google.com/safe-browsing/v4/usage-limits>) — but read the licence: **"The Safe Browsing API is for non-commercial use only (meaning 'not for sale or revenue generating purposes'); commercial users should refer to Web Risk."** Warnings must also carry **attribution to Google** with a link to the Safe Browsing Advisory and a false-positive disclaimer. **This is a real constraint worth deciding on now**: fine while wtrecords.gg is non-commercial, but it becomes a paid Web Risk dependency the day the site monetises. The default quota is deliberately **not published** (read it from the Cloud console after enabling) — commonly cited "10,000/day" figures are community lore, not documentation. v4 Lookup takes **up to 500 URLs per request** but sends full URLs to Google; **v5 `hashes.search`** avoids that — "only providing the hash prefix… Only a 4-byte hash prefix of the URL hashed is in the request" — at the cost of implementing canonicalisation and SHA-256 prefix expansion yourself.
- **VirusTotal** — public API is **"limited to 500 requests per day and a rate of 4 requests per minute"** and **"must not be used in commercial products or services"** **[P]** (<https://docs.virustotal.com/reference/public-vs-premium-api>). Fine as a second opinion at write time.
- **Cloudflare URL Scanner** — bulk scan up to 100 URLs, but **scans default to `Public` visibility** — "it will appear in the recent scans list and in search results" **[P]**. Scanning a creator's URL publishes it to Cloudflare Radar. Heavier than we need and a privacy gotcha.
- **PhishTank** (Cisco Talos) — phishing-only, community-sourced, plaintext HTTP endpoint, and new API-key registration has been restricted. **Spamhaus DBL** is designed for email filtering. Both are poor fits.
- **Interstitial "you are leaving this site" page** — OWASP endorses it **[P]**, and YouTube, Google and Steam all ship one. I would **not** build one, and §6.2 is now the proof rather than the intuition: **those interstitials are the laundering mechanism, not the defence.** They are exactly what lets an attacker route a visitor through an allowlisted host, and they train users to click through. Building our own would also create a route on `wtrecords.gg` that takes a user-controlled destination — i.e. we would ship the precise vulnerability class this section is about, on our own domain, in order to mitigate it. If the destination space is already `https://youtube.com/@<handle>`, an interstitial protects against nothing and costs a click. A visible external-link glyph plus the destination hostname in the link text achieves the honest 90% at zero risk.
- **Edit throttles.** #150 already flags rate limits as unspecified. Links need one: a creator who can rewrite a link fifty times a day can wait out a moderator's attention. Note the interaction — a throttle also protects the one-moderator queue from being DoS'd.

**Where a scanner actually belongs:** on the **personal-site** field, **at submission time**, as an input to the moderator's decision — not as a gate, not on render, not on the handle fields (there is nothing to scan; the destination is a platform profile).

### 6.5 What an allowlist buys, and what the personal-site field costs

**For the platform fields, the allowlist is free.** Handle storage means the "allowlist" is not a filter at all — it is the set of URL templates the code contains. There is no bypass to find because there is no user-controlled URL.

**The entire risk budget of this feature is the personal-site field.** It is the only place a user chooses a destination. Everything in §6.2, §6.4, and most of §6.3 exists because of that one field.

Both sides, honestly:

- **Drop it.** Zero URL-validation surface, zero scanner, zero interstitial question. Cost: a creator with a Patreon, a merch store, or a Linktree cannot link it — and §1.4 argued Linktree is precisely what keeps the platform list from growing. Dropping the field puts pressure back on the list.
- **Keep it.** The list stays at five forever. Cost: every mitigation in §6 becomes load-bearing.

**Middle ground, and my recommendation:** keep exactly **one** free-form site field, and make it the *only* moderated field. Concretely: `https:` only; parsed with the WHATWG URL parser; punycode rejected or displayed as punycode; canonicalised on store; `rel="ugc noopener"`; Safe Browsing checked at submission as advice to the moderator; **held in the shadow queue until approved** (which #150's shadow-review model already provides for free — the submitter sees their own change, everyone else sees the last approved value); rate-limited; and re-queued on every edit. The shadow is the mitigation that makes this affordable, and it is already being built for avatars.

---

## 7. What I would hand to the spec

1. **Five fields.** `youtube_handle`, `twitch_login`, `discord_invite_code`, `x_handle`, `website_url`. TikTok is a defensible sixth on Gaijin's evidence; nothing else clears the bar.
2. **Handles, not URLs**, everywhere but `website_url`. Accept a pasted URL in the UI, normalise to a handle, echo back what was stored.
3. **Per-platform validation** = length + character-class regex from §2, plus a normalised form for the uniqueness index. Do not encode a TikTok regex until it is verified.
4. **No brand icons. Wordmarks in muted ink**, each carrying its handle. This is a licensing conclusion, not an aesthetic preference (§4).
5. **`rel="ugc nofollow noopener"` + `referrerpolicy="origin"` + `target="_blank"` with an "opens in new tab" glyph.** Never `noreferrer` — it destroys the creator attribution that is the feature's entire point. Drop `nofollow` for verified creators later, as Google's own guidance sanctions.
6. **Unique index on `(platform, normalised_handle)`** — the cheapest anti-impersonation control available, and only expressible because of #2 (`youtube.com/@x`, `www.youtube.com/@x` and `youtube.com/@x/` are three strings for one channel).
6b. **Store the immutable ID alongside the handle where one is free** — YouTube `UC…`, Twitch numeric ID, SteamID64 — and render the handle as label only. YouTube states outright that it "reserves the right to change, reclaim, or remove a handle at any time."
7. **Links live behind CC status; edits re-enter the queue; the whole set rides #150's shadow.**
8. **Only `website_url` needs a scanner, and only at submission.**
9. **Where the data lives** is open (#150 lists it): links are creator identity, so they follow whatever `players`-vs-`profiles` answer the CC status itself gets. They should not split from the badge.

---

## 8. Open questions and unverified claims

Listed so nobody inherits them as facts.

- **Twitch's exact username length/charset** and **whether non-Partner usernames are recycled** — the primary help article 404s to non-browser clients, and a second pass also failed. Twitch is widely believed to run a 6-month recycling window; **unconfirmed**. Likewise **X's inactive-handle policy** (help.x.com 404/403s). YouTube's side of this question *is* now settled — see §2.
- **What FACEIT, HLTV and Liquipedia do about impersonation specifically** — FACEIT's help article 404s and Liquipedia 403s plain fetches. The `rel="me"` and handle-recycling findings are solid; this competitor-policy sub-question is a genuine gap. Flag it if it becomes load-bearing.
- **Google Safe Browsing's default quota** — deliberately unpublished; read it from the Cloud console after enabling. And the **non-commercial-use licence restriction needs a decision** if the site ever monetises.
- **X's brand rules on monochrome** — the toolkit page renders no rules. Historically permitted; unconfirmed.
- **Instagram, TikTok, Reddit brand rules** — all three pages are JS shells or block the fetcher. If any of those platforms are ever shipped, this must be redone in a real browser.
- **TikTok handle grammar** — deliberately not guessed.
- **Discord's `connections` OAuth scope** — the payload shape and whether it needs app review. This is the highest-leverage unknown in the document: if it works as documented it is near-free multi-platform verification through a provider we already use.
- **Discord's numeric clearspace ratio** — stated diagrammatically only.
- **Safe Browsing QPD/QPS** — free, but the ceiling is not published.
- **Per-creator link inventories for the top ~10 War Thunder channels** — named but not individually scraped. The ranking currently rests on Gaijin's thresholds and Liquipedia's schema convergence, which are stronger evidence anyway, but the direct sample would confirm it.
- **Twitch/YouTube's own social-link feature limits** — how many links each allows, and whether the field is free-form. Directionally known, not fetched.
- **Liquipedia's template docs** were read through search results, not fetched (403). The cross-wiki convergence is consistent enough to trust the shape; individual parameter names may be off.

---

## 9. Sources

**Publisher / niche**
- War Thunder Content Partnership — <https://warthunder.com/en/media/partnership> **[P]**
- Media Partnership Invitation (older thresholds) — <https://warthunder.com/en/news/3365-news-media-partnership-invitation-to-youtubers-streamers-content-creators-en> **[P]**
- Gaijin Guidelines for Content Creators — <https://legal.gaijin.net/contentrules> **[P, not read in depth]**

**URL shapes and handle grammar**
- YouTube channel URLs — <https://support.google.com/youtube/answer/6180214> **[P]**
- YouTube handles — <https://support.google.com/youtube/answer/11585688> **[P]**
- Twitch Username Transfer Policy — <https://link.twitch.tv/UsernamePolicy> **[S]**
- Twitch Helix API reference — <https://dev.twitch.tv/docs/api/reference/> **[P]**
- Discord New Usernames & Display Names — <https://support.discord.com/hc/en-us/articles/12620128861463-New-Usernames-Display-Names> **[S]**
- Discord: Evolving Usernames — <https://discord.com/blog/usernames/> **[S]**
- X username rules — <https://help.x.com/en/managing-your-account/x-username-rules> **[S]**

**Brand and licensing**
- YouTube API Services Branding Guidelines — <https://developers.google.com/youtube/terms/branding-guidelines> **[P]**
- YouTube brand resources — <https://www.youtube.com/howyoutubeworks/resources/brand-resources/> **[P]**
- Twitch brand assets — <https://brand.twitch.tv/> **[P]** (asset zip; guidelines text **[S]**)
- Discord branding — <https://discord.com/branding> **[P]**
- X brand toolkit — <https://about.x.com/en/who-we-are/brand-toolkit> **[P, no rules rendered]**
- Bluesky branding — <https://bsky.social/about/support/branding> **[P]**
- Facebook/Meta brand resources — <https://www.meta.com/brand/resources/facebook/logo/> **[P]**
- Patreon brand — <https://www.patreon.com/brand> **[P]**
- Simple Icons disclaimer — <https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md> **[P]**

**Safety**
- MDN `rel="noopener"` — <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener> **[P]**
- Google Search Central, qualify outbound links — <https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links> **[P]**
- OWASP Unvalidated Redirects and Forwards — <https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html> **[P]**
- Google Safe Browsing usage limits — <https://developers.google.com/safe-browsing/v4/usage-limits> **[P]**
- Google Search blog, open redirect abuse — <https://developers.google.com/search/blog/2009/01/open-redirect-urls-is-your-site-being> **[S]**
- YouTube redirect open-redirect writeups — <https://cybertamarin.medium.com/how-i-found-an-open-redirect-in-youtubes-redirect-link-cyber-tamarin-0cf2ddfedcdd>, <https://untrustednetwork.net/en/2019/07/22/half-open-redirect-vulnerability-in-youtube/> **[S]**

**Peers**
- Liquipedia `Template:Infobox_player` across wikis — <https://liquipedia.net/counterstrike/Template:Infobox_player> and siblings **[S]**

**This repository [R]**
- `DESIGN.md` — The One Amber Rule, The Earned Metal Rule, The Rationed Colour Rule, the chroma-neutral hall
- `CONTEXT.md` — Claim, Claim request ("Claims are never self-serve"), Player, Profile
- `src/auth/profile.ts:37-63` — `isAllowedAvatarHost`, exact-host allowlist + `https:`-only precedent
- `src/admin/api.ts:182` — "A prefix regex admits host-less values like `https://?x`; parse instead."
- `src/components/proof-gallery.tsx:61-62`, `src/routes/admin/records/$id.tsx:374,390,460,470` — current `rel="noreferrer"` outbound-link convention
- `package.json` — `lucide-react` is the only icon dependency; ships no brand marks

**Added in the safety pass (live-tested)**
- WHATWG HTML PR #4330, implicit `noopener` — <https://github.com/whatwg/html/pull/4330>; Firefox 79 release notes; WebKit STP 68 — <https://webkit.org/blog/8475/release-notes-for-safari-technology-preview-68/> **[P]**
- OWASP Reverse Tabnabbing — <https://owasp.org/www-community/attacks/Reverse_Tabnabbing> **[P]**
- OWASP SSRF Prevention (URL validation) — <https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html> **[P]**
- WHATWG URL Standard — <https://url.spec.whatwg.org/> **[P]**
- WCAG G200 / G201 / SC 3.2.5 — <https://www.w3.org/WAI/WCAG22/Techniques/general/G200>, <https://www.w3.org/WAI/WCAG22/Techniques/general/G201> **[P]**
- Mastodon profile verification (`rel="me"`) — <https://docs.joinmastodon.org/user/profile/> **[P]**; IndieWeb rel-me — <https://indieweb.org/rel-me> **[P]**
- Bluesky handle spec — <https://atproto.com/specs/handle> **[P]**
- Google Search Console ownership verification — <https://support.google.com/webmasters/answer/9008080> **[P]**
- YouTube Data API `channels.list` — <https://developers.google.com/youtube/v3/docs/channels/list> **[P]**
- Discord OAuth2 (`connections`) — <https://discord.com/developers/docs/topics/oauth2> **[P]**
- Steamworks auth / Steam OpenID — <https://partner.steamgames.com/doc/features/auth> **[P]**
- Safe Browsing v4 Lookup / v5 `hashes.search` — <https://developers.google.com/safe-browsing/v4/lookup-api>, <https://developers.google.com/safe-browsing> **[P]**
- VirusTotal public vs premium API — <https://docs.virustotal.com/reference/public-vs-premium-api> **[P]**
- Cloudflare URL Scanner — <https://developers.cloudflare.com/radar/investigate/url-scanner/> **[P]**
- Discord scams/phishing guidance — <https://support.discord.com/hc/en-us/articles/4407571667351-Scams-Spam-and-Phishing> **[P]**
- Steam phishing/scam support + community API-key-scam guides — <https://help.steampowered.com/en/faqs/view/76D0-06A1-0B3C-D426>, `steamcommunity.com/sharedfiles/filedetails/?id=1408053055` **[P]**
- Live-observed markup: <https://github.com/gaearon>, <https://itch.io/profile/leafo>, <https://linktr.ee/linktree> **[P — direct observation]**
- Redirect-endpoint behaviour table in §6.2 — **[P — direct observation, tested live]**
