# WT Records — Product Requirements Document

**Name:** *WT Records* · canonical domain `wtrecords.gg` (`recordswt.com` redirects in) — see §13
**Product:** Public world-record registry & leaderboard for War Thunder — most kills in a single life, per vehicle, **per game mode**. **Multi-mode by design; launching with Ground Realistic Battles (GRB) first** as the most popular, with Ground Arcade, Air RB, and Air Arcade scoped in later (§ multi-mode in §5).
**Status:** Draft v0.4 — for alignment
**Owner:** Khai
**Last updated:** 2026-06-28

> Decision tags: **[LOCKED]** agreed · **[PROPOSED]** my default, change freely · **[OPEN]** still needs a call (collected in §12).
> Changes since v0.1: stack moved to **Supabase + Drizzle** (was Convex); §9 schema is now relational; vehicle-catalog, proof, identity, and BR questions resolved; a Phase-1 **mod/CMS view** added; naming section added; **multi-mode dimension added (GRB first)**.
> Changes in v0.3: **§16 testing strategy** added (Vitest + PGlite / Playwright / promptfoo, fast-required vs non-blocking CI); **§8.1 spatial-scene depth-parallax** background added (Immersity AI primary; Depth Pro dropped on licensing); **§8.2 background-imagery IP** rule added; PostHog **session replay + consent banner** locked (§5).
> Changes in v0.4: **§9 schema generalized** — mode is **data not an enum** (`modes` table) with rule evaluation in versioned code; **JSONB removed for queryable data** (`vehicle_br`, `mode_min_kills` tables); player stats **derived via views** (no denormalized counters); `currentName`→`displayName`; **Discord + Google** linkable to one profile; Realtime built to extend to **aggregate streaming**.

---

## 1. Summary

The records live in a Google Sheet today, with submissions handled ad-hoc in Discord. This project replaces both with a fast, public, server-rendered site that shows every record exactly as the sheet does — a player leaderboard plus a per-nation sheet of who holds the kill record for each vehicle — but searchable, shareable, live, and good-looking.

**Phase 1 (this PRD):** the public site + a one-time migration from the **GRB** sheet, plus a bare-bones moderator CMS for correcting data. On-site submissions, auth-gated, and the screenshot-verification pipeline are deferred (§11) but the schema is built to accept them. **The data model and IA are mode-aware from day one** but populated with GRB only at launch; we own the other modes' sheets (Ground Arcade, Air RB, Air Arcade) and scope them in later as data + rules config, not as a schema change.

## 2. Goals & non-goals

**Goals**
- Reproduce 100% of the GRB sheet's information (leaderboard, per-nation sheets, holders, stats, rules) on a public site.
- Add what the sheet can't do: global search, sort/filter, vehicle & player pages, social-shareable SSR links.
- SSR for SEO and rich social unfurls; live updates when records change.
- A minimal moderator view to edit content without touching the DB directly.
- Lay the data + infra foundations that submissions, verification, **and additional game modes** plug into later.

**Non-goals (Phase 1)**
- Public on-site submission flow (Phase 2).
- Automated screenshot verification / anti-cheat (Phase 3).
- Importing the non-GRB mode sheets (schema-ready, populated post-launch).
- Anything mobile-native.

## 3. Background & current state

- Source of truth: a Google Sheet — Rules/Submitting, Leaderboard, DataSheet, and one tab per nation (USA, Germany, USSR, Britain, Japan, China, Italy, France, Sweden, Israel).
- Nation tabs sort by BR descending: `Kills · Vehicle · Player · BR · Patch · Screenshot · Screenshot 2 · Video`. Empty kill/player rows = unclaimed vehicles.
- Submissions go to five Discord moderators (itsmetsumi, nicojio, bvo, z.ento, thicturtle_) with proof images (believed to live on Imgur).
- Headline figures: **1083 records, 257 players, 91.55% complete, 100 unclaimed.**

## 4. Users

| Persona | Phase | Needs |
|---|---|---|
| **Viewer / record chaser** | 1 | Browse records, find unclaimed "open bounties", look up players, share links. |
| **Moderator / admin** | 1 (CMS) → 2 (review) | Run migration, correct records via a protected UI, later verify submissions. |
| **Record holder / submitter** | 2 | Submit a record with proof, see status, get credited under a canonical identity. |

## 5. Architecture [LOCKED]

- **Frontend:** TanStack Start — file-based routing, SSR for SEO + social unfurls, React. Server functions / route loaders query the DB via Drizzle and render server-side.
- **Database:** Supabase Postgres. Chosen over Convex because the data is fundamentally **relational/tabular** (vehicles ↔ records ↔ players), which maps cleanly to SQL and the sheet's row model.
- **ORM:** Drizzle — typed schema + `drizzle-kit` migrations over the Supabase Postgres instance. All reads/writes go through Drizzle from server code.
- **Auth [LOCKED — Discord + Google, one profile]:** Supabase Auth with **both Discord and Google OAuth**. A person has **one profile** (one `auth.users` row); if they have both accounts they can **link** them via Supabase **identity linking** (`linkIdentity()`), after which they can sign in with **either** provider and land on the same profile. `auth.identities` is the source of truth for which providers are attached. **Stood up in Phase 1 but scoped to moderators only** (a `profiles.role` of `moderator`/`admin` gates `/admin`; seed the five existing mods by hand); it **opens to the public in Phase 2** alongside `/submit`. The `auth.users` id is the **canonical, stable identity**; a person maps to **many in-game names** (`player_aliases`) and to one **record-holder `player`** (linked via `players.user_id` on claim) — login is what ties every IGN back to one user.
- **Auth scope — gate writes, never reads [LOCKED]:** the entire public site (leaderboard, nation sheets, vehicle/player pages, search, live feed) is **fully anonymous — no login wall, no session required**. Login is provoked **only by a write intent** (Phase 2 `/submit`, claiming an IGN, any mutation) and **just-in-time** (prompt on the action, not on page arrival). `/admin` is the sole role-gated-on-arrival route. This needs no extra work — the §9.2 read paths (SSR via Drizzle service role + `anon` Realtime) are already authless by design. **Decided:** logged-out users *see* the submit/contribute affordances and get the login prompt **on click** (inviting), never hidden behind a wall (members-only).
- **Storage:** Supabase Storage for proof images (migrated off Imgur — §10).
- **Realtime [Phase 1 feature, built to extend]:** Supabase Realtime powers a **live record feed** and a **live-updating leaderboard**. The browser subscribes directly, so this needs a **narrow read-only RLS policy** exposing only **verified/current** records to the `anon` role — pending/rejected stay mod-only, so nothing unverified can leak in before a human clears it. Phase 1 subscribes to `records` row changes (feed) and refetches the leaderboard on change. The layer is **not locked to raw rows**: when we later want live *aggregate* numbers (leaderboard/global stats animating as records land), we stream a derived stats table's changes or push computed payloads via Realtime **Broadcast** — see §9.2. All other public reads stay on Drizzle/SSR (service role); Realtime is the **only** path that touches the public Supabase client.
- **Observability & analytics:** **Sentry** for error + performance monitoring across the web app *and* the workers — especially the Phase-3 pipeline (failed LLM calls, stuck/retried jobs, extraction errors). **PostHog** for product analytics **with session replay** [LOCKED]. Replay sets persistent cookies, so a **consent banner is required** (this supersedes the earlier cookieless plan); replay initializes **only after opt-in**, with input masking on auth/sensitive fields. The banner is styled behind the glass aesthetic and must not fight the parallax.
- **Multi-mode [LOCKED]:** the platform tracks records **per game mode**, not just per vehicle. Modes: **GRB** (launch), then **Ground Arcade (GAB)**, **Air RB (ARB)**, **Air Arcade (AAB)** (extensible to Naval/Sim later). Records key on **(vehicle, mode)**; each mode is its own self-contained world — its own leaderboard, completion %, nation sheets, top-5, and **thresholds** (a tank's GRB record and GAB record are different records; Air modes count air kills with different minimums). A vehicle's **branch** (ground/air/naval) determines which modes it's eligible for and thus each mode's completion denominator. **Players are one identity across all modes** (profiles aggregate, with a per-mode breakdown). **Mode is data, not an enum** (a `modes` table), and every mode shares the same simple rule shape (per-class min kills + a difficult-vehicle override, §9), so the schema/IA/migration are mode-parameterized from day one; **only GRB is populated at launch**, and each later mode is a data addition — an `INSERT` into `modes` (+ its threshold/BR rows) and flipping `isLive` — not a migration.
- **Catalog sync:** scheduled job pulls the vehicle universe from the WT Vehicles API / datamine into our `vehicles` table per patch (§10).
- **Hosting [LOCKED — Railway]:** **Railway** (start Hobby → Pro at launch, §15), as a single platform for the whole compute tier — the TanStack Start SSR web app, the Phase-3 **record-processing + verification workers** (mostly I/O-bound LLM orchestration, plus an optional CPU-heavy forensics layer) and their **queue**, the self-hosted **WT Vehicles API** (the maintainer recommends self-hosting to dodge the rate limit), and the catalog-sync **cron**, all colocated. **Supabase remains the managed data plane** (DB/auth/storage; the queue can also live here via pgmq), so "our own backend" here means our own *compute/orchestration* tier, not a re-implementation of data. Rationale: Phase 3 is durable, multi-step, long-running work with a human-approval pause — serverless handles it poorly (execution-time limits, no persistent queue/state), so a container platform fits, and consolidating front+back on one platform cuts ops/billing overhead. **Trade-off:** Railway runs in-region rather than on a turnkey global edge CDN — use Railway's native HTML-caching CDN and/or front with **Cloudflare** (SSL = Full, not Strict) for global caching + WAF/DDoS. The one-time **migration script** runs in CI/local.
  - **Alternative considered — Sevalla** (Kinsta's PaaS on GCP + Cloudflare): same single-platform consolidation as Railway (containers, managed Postgres/Redis, background workers, cron/queues, custom Docker, S3 storage) but with **edge CDN + WAF/DDoS built in natively** — removing both of Railway's weak points (no edge, Cloudflare-proxy fiddliness) at a modest cost premium and with a younger track record. Worth an empirical bake-off (it offers $50/2-month credits): deploy the SSR app on both, compare p75 TTFB from EU/APAC/NA and actual monthly burn. Other options weighed in the ADR: Vercel/Netlify (excellent edge, but serverless can't host the worker tier → forces a split), Render (Railway-class), Fly.io (global compute, more ops), raw VPS for the forensics worker.

## 6. Information architecture & routing [PROPOSED]

**Mode is the top dimension.** A persistent **mode switcher** (GRB / GAB / ARB / AAB) sits above the nation switcher in the nav, and mode is in the **URL path** for clean per-mode SSR + shareable links. Default landing mode = **GRB**. At launch only GRB resolves; other mode routes exist but read "coming soon" until populated.

```
/                       Home (defaults to GRB) — global stats, top 5, latest record, leaderboard preview
/$mode                  Mode home (e.g. /grb, /arb) — that mode's stats + previews
/$mode/leaderboard      Full player standings for the mode
/$mode/nations          Nations index — completion ring per nation, for the mode
/$mode/nation/$slug     A nation's full records sheet for the mode (core view)
/$mode/vehicle/$slug    Vehicle detail for the mode — current holder, proof, run BR, (later) history
/player/$slug           Player profile — cross-mode, aggregated; current name + "previously known as"
/rules/$mode            Rules & submission protocol (per-mode rule set; GRB at launch)
/admin                  Phase-1 moderator CMS (auth + role gated)
/$mode/submit           Phase 2 — public submission flow (mode-scoped)
/search                 Global search (command-palette overlay; mode-aware)

# server routes
/og/$mode/{nation|vehicle}/$slug.png   Dynamic Open Graph images (mode-scoped)
/og/player/$slug.png                   Player OG (cross-mode)
```

Vehicle & player pages exist beyond a literal sheet-clone because they're the natural SSR-indexable, shareable units — the links people paste in Discord. Player is the one **cross-mode** page; everything else is mode-scoped.

**Names display [PROPOSED].** Everywhere, the **primary** name is the holder's current live `displayName` (recognizable, updates on rename, links to their profile). On a **record row**, two **secondary** snapshots — both immutable, frozen at submission — give the at-the-time context: `ignSnapshot` (the in-game name on that run's scoreboard, "as «IGN»") and `displayNameSnapshot` (the holder's site display name when they submitted). This mirrors the spreadsheet's layout (current player name primary, the at-the-time names as supporting info). The **profile** shows the current `displayName` plus **"previously known as"** (from the `player_aliases` name history).

## 7. Functional requirements — Phase 1

**Public site** — same as v0.1: global stats, top 5, latest record, player standings; per-nation sheet with BR-desc table, search, sort (BR ↔ kills), filter (All/Held/Open), open-bounty rows; nation completion rings + avg kills; proof lightbox + video links; vehicle & player pages; rules page; global search; SSR + OG images; responsive; live updates.

**Moderator CMS (`/admin`) [LOCKED]** — bare but real:
- **Auth + role gate via Supabase Auth (Discord OAuth), Phase 1, mods only** — `profiles.role in (moderator, admin)`; the five existing mods are seeded by hand. (Public auth + `/submit` arrive in Phase 2.)
- CRUD on records: edit kills, holder, run BR, patch, proof, current-flag; create/retire records; reassign holder.
- Edit player aliases / merge duplicate players.
- Light edit of vehicle overrides (e.g., `isDifficult`, `minKills`) — catalog itself is sync-managed.
- Every write lands in an `audit_log` row (who/what/when/before→after).
- This replaces "edit the spreadsheet" as the content-management surface at launch.

**Interim submission workflow (launch → Phase 2) [LOCKED].** No public `/submit` in Phase 1, so intake stays on **Discord exactly as today** — but mods enter accepted records through `/admin` instead of the sheet, and the sheet is retired at cutover. Phase 2 replaces the Discord intake with `/submit`.

**Record-supersede rule [LOCKED].** A submission must **strictly exceed** the current record's kills to take the title; an equal score does **not** displace the incumbent (first-to-achieve keeps it). One `isCurrent` record **per (vehicle, mode)**; the prior holder drops to history. **Qualifying thresholds are per-mode, per vehicle class**, with a separate bar for vehicles flagged *difficult* — GRB's set (tanks only, one life, the sheet's per-class minimums + difficult list) is the launch config; each added mode supplies its own `mode_min_kills` rows + `difficultMinKills` (e.g., Air modes count air kills with different minimums).

## 8. Design system [LOCKED]

Direction: **frosted-glass / iOS, with a parallax atmospheric background.** Reference: `wt-glass-concept.html` (locked look). Frontend gets iterated further in a separate session — this is the source of truth for intent.

- **Materials:** thin material on the floating nav, thicker frost on hero/cards. Every glass surface = `backdrop-filter: blur + saturate`, 1px hairline border `rgba(255,255,255,.16)`, inset top highlight `inset 0 1px 0 rgba(255,255,255,.2)`, ~22–26px continuous radii.
- **Background:** community or self-captured in-game screenshots (see §8.2 for the IP/provenance rule), dimmed behind a dark scrim for legibility, parallaxing on pointer + scroll, **swapping per nation** (and, across modes, per branch — ground vs. air scenery).
- **Navigation:** a **mode switcher** (GRB/GAB/ARB/AAB) is the top-level primary nav, sitting above the per-nation switcher; the active mode is reflected in the URL and the page chrome.
- **Tokens:** accent amber `#F0B94A`; base `#0a0c10`; text `rgba(255,255,255,.96/.6/.4)`; system font stack (SF Pro / Inter), **tabular numerics everywhere**; rank metals gold `#FFD75E` / silver `#D6DBE2` / bronze `#E0995A`.
- **Motion:** spring-eased hover lift, count-up stats, layered parallax, ambient embers — all behind `prefers-reduced-motion`.
- **Quality floor:** visible keyboard focus, scrim-enforced contrast over imagery, reduced motion respected, mobile-first responsive.

**8.1 Spatial-scene background [PROPOSED enhancement].** Upgrade the hero/background from flat layered parallax to an **iOS 26 "spatial scene"–style depth parallax** — the subject appears to separate from the background as the viewer moves the pointer (desktop) or tilts the device (gyro). This reuses the parallax inputs the design already has; it changes how the background layer is *produced and rendered*, not the overall architecture.

- **Approach: depth-map displacement (best effort-to-payoff).** Because backgrounds are a **small, curated, fixed set** (not user uploads), do the expensive work **offline, once per image**, and ship static assets — no ML in the user's browser.
  - **Offline (generate a depth map per background, once):** primary path is **Immersity AI** (formerly LeiaPix, by Leia Inc.) — a hosted 2D→depth/parallax service that exports **editable depth-map PNGs** and grants **commercial rights + watermark-free export on its paid Image plan (~$5/mo, 500 credits, 1 credit = 1 image, up to 4K)**. Since backgrounds are a small curated set, subscribe **one month, batch every image, export the depth maps, cancel** (500 credits is far more than needed). Use its in-browser depth editor to fix foreground/background bleed. **Free fallback:** **Depth Anything V2 *Small*** (Apache-2.0 — Base/Large/Giant are CC-BY-NC, non-commercial, so *only* Small qualifies) run offline. Both emit a grayscale depth PNG. Commit `image.jpg` + `image-depth.png` (depth compresses well and can be downscaled).
    - *License note:* **avoid self-hosting Apple Depth Pro** despite its sharper edges — it ships under an Apple research/sample license (`apple-amlr` weights / `Apple-ASCL` code), **not** Apache/MIT, and Apple has left the commercial-use question formally unanswered; hosting it elsewhere doesn't cure the model license. Immersity gives equivalent quality with explicit commercial rights.
  - **Runtime:** render one textured quad with a lightweight **WebGL / React-Three-Fiber depth-displacement shader** — offset the image's UV sample by `depth.r × pointer/gyro`, so nearer (brighter) pixels move more. The frosted-glass UI stays as DOM/CSS layers **above** the WebGL canvas (canvas as background).
- **Fallback / simpler path:** for an image with one clean subject, a **2-layer cutout** (subject as transparent PNG over the background, offset on motion — pure CSS/JS, no WebGL) gives most of the effect for far less work; keep it as the low-end/degraded path.
- **Performance & a11y:** the depth map is static, so GPU cost is ~one quad — cheap on mobile. Prefer **WebGL over WebGPU** for reach (treat WebGPU as enhancement); clamp displacement to a few percent for a subtle, Apple-like feel; ship a **static-image fallback** where WebGL is unavailable; and **disable/greatly reduce** the effect under `prefers-reduced-motion` (as iOS itself does).

**8.2 Background imagery — IP, provenance & monetization contingency [PROPOSED].** Every War Thunder screenshot — community-submitted *or* self-captured — depicts **Gaijin's** copyrighted models/maps/UI, so the governing rule is **Gaijin's fan-content policy, not creator permission**. Two rights layers exist: the creator's thin rights in framing/timing (competition entrants have typically waived these *to Gaijin*, not to the public or to us), and Gaijin's always-present rights in the game itself. Implications:

- **Provenance rule (in priority order):** (1) Gaijin fan-content policy / EULA is the legal basis; (2) creator **attribution** is courtesy + community goodwill, *not* the legal basis — credit anyway, but don't treat a creator's "ok" as the thing that makes use permissible. Self-capturing our own screenshots **removes the third-party/attribution layer** (no waiver/consent to track) but **does not change the Gaijin-IP layer** — "I shot it myself" is not a commercial license to the underlying game assets.
- **Current status: non-commercial.** No ads, donations, sales, sponsorships, or upsell; infra is owner-funded. This is the permissive case under fan policy. (Note "commercial" keys on operating *for commercial advantage* — ads/donations/upsell can count — not on whether the site is profitable; running at a loss does not by itself make it non-commercial. We're clear today because there's simply no monetization at all.)
- **Monetization is the trigger to revisit, and the lever is the imagery — not who shot it.** If WT Records ever adds donations/Ko-fi/Patreon, ads, merch, or sponsorship, re-read Gaijin's policy **before** flipping it on. At that point the bulletproof move is to **remove or replace** game imagery, not to swap community shots for self-shot ones (both still contain Gaijin IP).
- **Pre-planned non-game fallback:** the frosted-glass aesthetic leans on blur/scrim/depth, so a no-game-imagery background is low-cost — an **abstract amber-tinted gradient or generated texture** behind the same glass (still depth-parallaxable via §8.1), or owned/commercially-licensed non-game imagery. Keep this as the ready substitute if the site monetizes or if any image's provenance is ever in doubt. *(Not legal advice; confirm against Gaijin's current fan-content terms before any monetization.)*

## 9. Data model [PROPOSED] — Drizzle / Postgres

Relational schema. Three principles applied here: **(1) modes are data, not an enum** — a `modes` table means adding GAB/ARB/AAB is an `INSERT`, never a schema migration. The qualifying rule is **uniform across all modes** (a minimum kill count per vehicle class, with a separate threshold for vehicles flagged *difficult*), so rules are just parameters in tables checked by one shared function — no rules engine needed; **(2) queryable data is tabular — JSONB only for opaque store-and-display blobs** (the `audit_log` diff and the Phase-3 raw LLM payload), never for anything we filter/join on; **(3) player/leaderboard stats are derived** (SQL views over `records`), a single source of truth rather than denormalized counters. `vehicles` is the synced catalog (the completion denominator); `records` holds one `isCurrent` row per **(vehicle, mode)** plus history; a record with `status='pending'` *is* a Phase-2 submission (no separate table). Aggregates are computed **per mode**. Mode-aware from day one; GRB-only data at launch.

```ts
// db/schema.ts  (drizzle-orm / pg-core)
import { pgTable, pgEnum, serial, uuid, text, integer, real,
         boolean, timestamp, jsonb, uniqueIndex, index, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Mode is a TABLE (see `modes`), not an enum — so new modes are data, not migrations.
// App code can still keep a TS union (e.g. "grb"|"gab"|"arb"|"aab") for typing without constraining the DB.
export const branch   = pgEnum("branch",
  ["ground","air","naval"]);             // stable, closed set → enum is fine; determines mode eligibility + class set
export const vehicleClass = pgEnum("vehicle_class",
  // ground: light/medium/heavy/spg/spaa · air: fighter/attacker/bomber/heli · + other
  ["light","medium","heavy","spg","spaa","fighter","attacker","bomber","heli","other"]);
export const recordStatus = pgEnum("record_status",
  ["verified","pending","rejected"]);
export const role         = pgEnum("role",
  ["viewer","moderator","admin"]);
export const proofKind    = pgEnum("proof_kind",
  ["scoreboard","end_game","end_life","video"]);

// Canonical mode registry + that mode's metadata, human rules text, and the difficult-vehicle threshold.
// Adding a mode = INSERT here (+ its per-class threshold rows + BR rows). No rulesVersion needed —
// every mode uses the same rule structure (per-class min kills + a difficult override).
export const modes = pgTable("modes", {
  mode:            text("mode").primaryKey(),       // "grb","gab","arb","aab", … (data, not an enum)
  name:            text("name").notNull(),          // "Ground Realistic Battles"
  branch:          branch("branch").notNull(),      // which vehicle branch supplies this mode
  rulesMd:         text("rules_md"),                // human-readable rules page content
  difficultMinKills: integer("difficult_min_kills"), // threshold for isDifficult vehicles in this mode
  isLive:          boolean("is_live").notNull().default(false), // GRB true at launch; others false
  sort:            integer("sort").notNull().default(0),
});

// Qualifying kill threshold per (mode, class) — the standard bar; the difficult override above replaces it for flagged vehicles.
export const modeMinKills = pgTable("mode_min_kills", {
  mode:      text("mode").references(() => modes.mode).notNull(),
  class:     vehicleClass("class").notNull(),
  minKills:  integer("min_kills").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.mode, t.class] }) }));

export const nations = pgTable("nations", {
  id:   serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),       // "usa", "germany", ...
  name: text("name").notNull(),
  sort: integer("sort").notNull(),
  backgroundUrl: text("background_url"),         // per-nation parallax bg
});

export const vehicles = pgTable("vehicles", {
  id:         serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(), // datamine/API key
  name:       text("name").notNull(),
  slug:       text("slug").notNull().unique(),
  nationId:   integer("nation_id").references(() => nations.id).notNull(),
  branch:     branch("branch").notNull(),        // ground/air/naval → eligible modes
  class:      vehicleClass("class").notNull(),
  rank:       integer("rank"),                   // tech-tree order
  isPremium:  boolean("is_premium").default(false),
  isSquadron: boolean("is_squadron").default(false),
  isEvent:    boolean("is_event").default(false),
  isRemoved:  boolean("is_removed").default(false), // limited/no longer obtainable
  imageUrl:   text("image_url"),
  isDifficult:boolean("is_difficult").default(false), // manual rules overlay
  lastSyncedAt: timestamp("last_synced_at"),
}, (t) => ({ byNation: index("veh_nation_idx").on(t.nationId),
             byBranch: index("veh_branch_idx").on(t.branch) }));

// Current in-game BR per (vehicle, mode) — a TABLE, not JSONB. No row = vehicle absent in that mode.
export const vehicleBr = pgTable("vehicle_br", {
  vehicleId: integer("vehicle_id").references(() => vehicles.id).notNull(),
  mode:      text("mode").references(() => modes.mode).notNull(),
  br:        real("br").notNull(),               // synced per patch
}, (t) => ({ pk: primaryKey({ columns: [t.vehicleId, t.mode] }) }));

export const players = pgTable("players", {
  id:          serial("id").primaryKey(),
  slug:        text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),   // CURRENT chosen name — the PRIMARY name shown everywhere (record rows, leaderboard, profile header), via live join. A rename updates the primary label on all their records; the at-the-time names are preserved as secondary snapshots on each record (ignSnapshot + displayNameSnapshot).
  userId:      uuid("user_id"),                  // -> auth.users; NULL until claimed (canonical account link). Accountless (migrated) players are a permanent valid state; claiming is required only to SUBMIT.
  // No denormalized recordCount/totalKills/avgKills — derived from `records` via the §9.1 view.
}, (t) => ({ byUser: index("ply_user_idx").on(t.userId) }));

// Name history — powers "previously known as" on the profile. Every name the person has gone by.
export const playerAliases = pgTable("player_aliases", {
  id:        serial("id").primaryKey(),
  playerId:  integer("player_id").references(() => players.id).notNull(),
  name:      text("name").notNull(),
  kind:      text("kind").default("ign"),         // "ign" (in-game name) | "display" (former site display name)
  source:    text("source").default("ingame"),    // "migration" | "ingame" | "submission"
  firstSeen: timestamp("first_seen").defaultNow(),
  lastSeen:  timestamp("last_seen").defaultNow(),
}, (t) => ({ uniq: uniqueIndex("alias_uq").on(t.playerId, t.name, t.kind) }));

export const records = pgTable("records", {
  id:           serial("id").primaryKey(),
  vehicleId:    integer("vehicle_id").references(() => vehicles.id).notNull(),
  mode:         text("mode").references(() => modes.mode).notNull(), // record is per (vehicle, mode)
  playerId:     integer("player_id").references(() => players.id).notNull(),
  ignSnapshot:  text("ign_snapshot").notNull(),   // SECONDARY: in-game name on THIS run's scoreboard ("as «IGN»"); immutable (frozen at submit / from the sheet at migration)
  displayNameSnapshot: text("display_name_snapshot"), // SECONDARY: the holder's site displayName AT submit time; immutable. Captured live on Phase-2 submission; seeded from the sheet name at migration.
  kills:        integer("kills").notNull(),
  runBr:        real("run_br"),                   // BR at the time of the run
  patch:        text("patch"),                    // "2.53"
  status:       recordStatus("status").notNull().default("verified"),
  isCurrent:    boolean("is_current").notNull().default(true),
  videoUrl:     text("video_url"),
  importedFrom: text("imported_from"),            // "sheet" for migrated rows
  submittedById: uuid("submitted_by_id"),         // -> auth.users (Phase 2)
  submittedAt:  timestamp("submitted_at").defaultNow(),
  verifiedAt:   timestamp("verified_at"),
  verifiedById: uuid("verified_by_id"),
}, (t) => ({
  byVehicleMode: index("rec_vehicle_mode_idx").on(t.vehicleId, t.mode),
  // at most one current record per (vehicle, mode):
  oneCurrent:    uniqueIndex("rec_current_uq").on(t.vehicleId, t.mode)
                   .where(sql`is_current`),
  byMode:        index("rec_mode_idx").on(t.mode),
  byPlayer:      index("rec_player_idx").on(t.playerId),
  byKills:       index("rec_kills_idx").on(t.kills),
}));

export const recordProof = pgTable("record_proof", {
  id:          serial("id").primaryKey(),
  recordId:    integer("record_id").references(() => records.id).notNull(),
  kind:        proofKind("kind").notNull(),
  storagePath: text("storage_path"),              // Supabase Storage key
  originalUrl: text("original_url"),              // source Imgur/Discord URL
  sort:        integer("sort").default(0),
});

// Account-level row, 1:1 with Supabase auth.users. A `player` (record holder) can exist with
// NO profile (all migrated players start accountless); the link is `players.user_id` (set on claim).
// Discord + Google can both be linked to ONE auth user via Supabase identity linking — auth.identities
// is the source of truth for which providers are attached; the handles below are convenience copies.
export const profiles = pgTable("profiles", {
  id:           uuid("id").primaryKey(),          // = auth.users.id
  handle:       text("handle"),
  discordId:    text("discord_id"),               // convenience; auth.identities is canonical
  googleEmail:  text("google_email"),             // convenience; auth.identities is canonical
  role:         role("role").notNull().default("viewer"),
});

export const auditLog = pgTable("audit_log", {
  id:        serial("id").primaryKey(),
  actorId:   uuid("actor_id"),
  action:    text("action").notNull(),            // "record.update", ...
  entity:    text("entity").notNull(),
  entityId:  text("entity_id"),
  diff:      jsonb("diff"),                        // before -> after — legit JSONB: opaque, store-and-display, never queried into
  createdAt: timestamp("created_at").defaultNow(),
});
```

**9.1 Aggregates (per mode) — derived, single source of truth.** No counters are stored on `players`; everything is computed from `records` as Postgres views (Drizzle can map them). Start as plain views; if a hot path needs it, promote to **materialized views** refreshed on record change (still derived — just cached). Each is computed **per `mode`**:
- `player_stats` (by mode + all-modes): record count, total kills, avg kills per player — replaces the old denormalized columns.
- `global_stats` (by mode): total verified records, distinct players, completion %, remaining, avg & median kills, latest record id.
- `nation_stats` (by mode): per nation — held, total, completion %, avg kills.
- `leaderboard` (by mode) + an **all-modes** leaderboard: players ranked by current verified record count.
- **Completion denominator is per-mode** = all `vehicles` whose `branch` is eligible for that mode (ground branch → GRB & GAB; air branch → ARB & AAB), with premium/squadron/event/removed all included (per your call).
- Player profiles are **cross-mode** (totals + a per-mode breakdown), read straight from these views.

**9.2 Access pattern, RLS & Realtime [flexible by design].** Two read paths: (1) **SSR/Drizzle (service role)** for all rendered pages — fast, RLS-bypassing, the default; (2) **Supabase client + Realtime** for live updates, the *only* path exposed to the browser. Writes are server-side only (Drizzle service role from `/admin` and, in Phase 3, the worker). The Realtime layer is intentionally **not hardcoded to raw row events** — treat "what the client subscribes to" as a channel abstraction with room to grow:
- **Phase 1 (now):** subscribe to `records` row changes for the **live record feed**; the **leaderboard** refreshes by refetch on a `records` change event. Needs a **read-only RLS policy** on `records` allowing the `anon` role to `SELECT` **only `status='verified'` / `isCurrent` rows** (pending/rejected stay mod-only); subscriptions filter by `mode`.
- **Future (aggregated live stats):** when we want the leaderboard *numbers* and global stats to animate live as records land, two paths fit without re-architecting — (a) persist aggregates in a **materialized stats table** (§9.1) and stream **its** change events (clients get aggregate-level updates, not raw rows), with its own narrow `anon` read policy; or (b) use Supabase **Realtime Broadcast** to push a computed payload from a DB trigger or the Phase-3 worker on each accepted record. Either way the derived-stats representation from §9.1 is the thing we stream, which is exactly why stats are a view/table and not denormalized columns.

## 10. Migration & data sourcing

A one-time import **per mode**; the importer is parameterized by mode and run for **GRB first**. We own the other modes' sheets (GAB, ARB, AAB) and re-run the same importer for each later. The site becomes source of truth at cutover.

1. **Vehicle catalog [PROPOSED].** Sync from the **WT Vehicles API** (`wtvehiclesapi.duckdns.org`, built on the gszabi99 datamine; GPL-3.0) into `vehicles` (+ per-mode rows in `vehicle_br`) — covers all vehicles (ground **and air/heli**) incl. hidden/event/premium, with nation, per-mode BR, type→`branch`+`class`, rank, images. Self-host or cache to respect its rate limit. The `isDifficult` flag is a manual overlay on `vehicles`; per-class qualifying thresholds live in `mode_min_kills` and the difficult-vehicle override in `modes.difficultMinKills` (from each mode's rules). Re-run per patch. Wiki (`wiki.warthunder.com`) is the human cross-check.
2. **Records + players (per mode).** For the mode being imported (GRB at launch), parse its nation tabs + Leaderboard + DataSheet. Match each row to a `vehicle` by name+nation+branch (fuzzy-match to handle emoji/symbol prefixes and edge rows). Create/reuse `players` (seed `displayName` from the sheet name + a `migration` alias in the name history) and insert `records` with that **`mode`** (`status=verified`, `isCurrent=true`, `ignSnapshot` and `displayNameSnapshot` both seeded from the sheet name, `runBr`, `patch`). **Keep edge-case rows** (YouTube Cup placeholders, `Floppa`, symbol-prefixed names, odd patch strings) per your call — normalize lightly, don't drop. Players are shared across modes, so importing a later mode links records to existing player rows rather than duplicating them.
3. **Proof images + dates, in one pass [LOCKED].** Proof lives on **Imgur**. Extract the Imgur URLs from the sheet's `Screenshot/Screenshot 2/Video` cells (they're expected to be hyperlinks → pull via the Google Sheets API, which exposes cell links), then for each: call the **Imgur API** for the image's `datetime` (upload time) and download the file to **Supabase Storage** → populate `record_proof`. **Use the Imgur upload date as the record's `submittedAt`** — a good approximation that avoids any Discord scrape. So proof migration *and* date backfill are the same job.
   - *Caveat:* Imgur purged many anonymous (non-account) uploads in 2023, so some old links may be dead. For those, fall back to the sheet import date for `submittedAt` and flag the record as missing proof for a moderator to re-source later.
   - *Implementation note:* if a cell turns out not to be hyperlinked, that row's URL isn't recoverable from the sheet — handle as the dead-link case above.

## 11. Phased roadmap

The Phase 1→3 axis is **read → submit → auto-process**. **Mode expansion is an orthogonal track**: because the schema/IA/migration are mode-aware from the start and **mode is data** (§9), adding GAB / ARB / AAB at any point is a data import (§10) + an `INSERT` into `modes` (with its per-class `mode_min_kills` / `difficultMinKills` and `vehicle_br` rows) + turning on its `isLive` flag — not a new phase of engineering. Launch ships GRB live; light up the other three when their data's ready.

- **Phase 1 — Public site + GRB migration + mod CMS** (this PRD).
- **Phase 2 — Public submissions & identity:** Supabase Auth **opens to the public** (it already exists from Phase 1 for mods); login via **Discord or Google**, with both linkable to one profile (§5). Migrated holders stay **accountless and fully visible indefinitely** — an account is needed only to **submit**. To submit, a holder logs in (creating their profile) and **claims** their IGN(s) (sets `players.user_id`), which also ties their existing migrated records to the account; the `/admin` merge tool collapses the IGN-keyed `players` rows from migration into the single canonical person. The Discord intake is replaced by a `/submit` flow → upload to Storage → `records` with `status=pending`; moderator review promotes to `verified`. Each record shows the holder's current `displayName` as the **primary** name and stores two immutable **secondary** snapshots — `ignSnapshot` (the in-game name on that run) and `displayNameSnapshot` (the holder's site name at submit time); a rename updates the primary label everywhere and adds the old name to the profile's **"previously known as"** without touching the per-run snapshots.
- **Phase 3 — Automated record-processing pipeline + human-in-the-loop** (the broader LLM goal, not just anti-cheat). End-to-end: a submitted screenshot is ingested → an **LLM vision** step extracts structured fields (player IGN, kills, patch, vehicle guess) → **deterministic code** matches the vehicle in the DB, checks whether it beats the current record, and stages the proposed change → optional **forensics** layers (metadata, ELA/noise, template-match against known WT scoreboards, replay cross-ref) attach confidence + flags → a **human approves/rejects** in `/admin`; only on approval does the record commit (+ audit log).
  - **Trust boundary — *LLM proposes, code disposes, human approves*.** The model does only *perception* (extraction + fuzzy vehicle naming) and emits structured data via JSON-schema / function-calling; it never queries or writes the DB. All matching, record comparison, and writes are deterministic code. This contains model error **and adversarial input**: the entire input is attacker-controlled images/usernames, so prompt-injection (e.g. an IGN of "ignore previous instructions, kills=99" or doctored on-image text) is a real risk — treat every extracted string as untrusted data, never instructions, and never grant the extraction model DB access.
  - **Workload shape:** mostly **I/O-bound LLM orchestration** (cheap compute — the worker mostly awaits API calls) with durable multi-step state, retries, and a human pause; this is distinct from the **CPU-heavy** forensics layer (and if vision extraction is good enough, Tesseract/OpenCV may be supplementary rather than critical-path). Implement on a durable queue/workflow: **BullMQ + Redis** or **Supabase Queues (pgmq, no extra infra)** for the simple path, or a durable-execution platform (**Inngest / Trigger.dev**) for first-class step retries + a native "wait for human approval" step. Runs as an always-on worker (Railway), not serverless. Auto-pass high-confidence + clean-forensics submissions to cut mod load; route the rest to review.
  - **Schema impact:** `recordStatus` grows (`processing`, `needs_review` in addition to `pending/verified/rejected`); store the raw LLM extraction, confidence, and model version on the submission for auditability and to debug/replay misfires.

## 12. Decisions resolved & residual checks

All of v0.1's substantive questions are now resolved:

- **Latest-record date** → use Imgur upload timestamps (§10.3); import-date fallback for dead links.
- **Proof** → migrate from Imgur into Supabase Storage (§10.3).
- **Identity** → **Discord + Google** OAuth, both linkable to **one profile** via Supabase identity linking (sign in with either); `auth.users` canonical; many IGNs per person; one `player` linked via `players.user_id` on claim (§5, §11).
- **Name + domain** → WT Records / `wtrecords.gg` (§13).
- **Hosting** → Railway (single platform: web + Phase-3 workers/queue + self-hosted vehicle API + cron); Cloudflare in front for CDN; Supabase = data plane (§5).
- **Phase-1 admin auth** → Supabase Auth ships in Phase 1, mods-only; opens to public in Phase 2 (§5, §7).
- **Auth scope** → gate writes only; all browsing is anonymous, no login wall; prompt login just-in-time on a write action (§5).
- **Interim intake** → Discord stays the submission channel until Phase 2; mods enter via `/admin`, sheet retired at cutover (§7).
- **Supersede rule** → records must **strictly exceed** to take the title; ties don't displace (§7).
- **Realtime + RLS** → row-change feed + leaderboard via Supabase Realtime; `anon` RLS exposes verified/current rows only; built to extend to **aggregate streaming** (stats-table changes or Broadcast) without re-architecting; SSR reads stay on Drizzle service role (§5, §9.2).
- **Observability** → Sentry (web + workers) + PostHog **with session replay + consent banner** (§5).
- **WT Vehicles API license** → GPL-3.0 permits forking/modifying; self-hosting (no distribution) doesn't trigger copyleft on our changes — verify it's GPL-3.0 *not* AGPL-3.0, keep notices/attribution (§10).
- **Multi-mode** → records key on (vehicle, mode); per-mode leaderboards/completion/rules; mode in the URL with a top-level switcher; players are cross-mode; **mode is data (a `modes` table), not an enum**, so other modes are added by `INSERT` (+ threshold/BR rows), GRB-only data at launch (§1, §5, §6, §9, §10, §11).
- **Schema shape (anti-lock-in)** → modes-as-data (adding a mode = `INSERT`); the qualifying rule is **uniform across modes** — per-class min kills (`mode_min_kills`) with a difficult-vehicle override (`modes.difficultMinKills`), checked by one shared function (no rules engine, no `rulesVersion`); **no JSONB for queryable data** (per-mode BR → `vehicle_br` table; only `audit_log.diff` and the Phase-3 raw LLM payload stay JSONB as opaque blobs); player stats **derived via views**, not denormalized; **names:** primary = current live `displayName` everywhere; each record also stores two immutable **secondary** snapshots — `ignSnapshot` (in-game name on that run) and `displayNameSnapshot` (site name at submit) — and the profile shows **"previously known as"** from `player_aliases` (matches the spreadsheet layout) (§6, §7, §9).
- **Accountless holders** → migrated record-holders are visible and hold records **with no account, permanently**; an account (Discord/Google) is required **only to submit a new record**, at which point the user claims their `player` (links existing records too) (§5, §11).
- **Background imagery IP** → governed by **Gaijin's fan-content policy** (all in-game shots contain Gaijin IP), not creator permission; creator credit is courtesy only. Site is **non-commercial** today (the permissive case). Monetization (donations/ads/merch) is the trigger to revisit, with a pre-planned switch to an **abstract/owned-imagery** background; self-shooting doesn't change the Gaijin-IP layer (§8.2).

**Residual — implementation-time, not blockers:**
1. Confirm the sheet's proof cells are actually hyperlinked (decides URL extraction path; dead-link handling already specified either way).
2. Exact datamine field → `class` enum mapping, and the authoritative `isDifficult` list + per-class thresholds (`mode_min_kills`) and difficult override (`modes.difficultMinKills`), finalized during the catalog-sync build.
3. Fuzzy-match rules for sheet→vehicle name reconciliation (emoji/symbol prefixes, duplicate names across nations).

## 13. Naming & domain [LOCKED]

**Brand: WT Records.** Both domains purchased.

- **Canonical:** `wtrecords.gg` — community shorthand, shortest to type, matches the `WT·RECORDS` wordmark in the glass mock.
- **Redirect:** `recordswt.com` → `wtrecords.gg` (cheap defensive `.com`). Use a **301** so search/social signals consolidate on the canonical, and set a site-wide `<link rel="canonical">` to the `wtrecords.gg` origin so the redirect domain never competes in unfurls or indexing.

Still worth grabbing: matching Discord vanity + social handles. Earlier alternatives (ThunderRecords, AceThunder, Spaded, etc.) shelved.

## 14. Success criteria

- The site replaces the sheet for viewing — the community links to it instead.
- Every figure reconciles with migrated sheet data at cutover.
- Nation/vehicle/player links unfurl correctly when shared.
- Moderators manage content entirely through `/admin`, never the raw DB.
- Schema + Storage + auth seams make Phase 2 an additive build, not a refactor.

## 15. Launch ops — Railway Hobby → Pro

Start on **Hobby** to prototype and deploy cheaply; move to **Pro** **a few days before the community announcement**, not the morning of. The upgrade is a billing/limits switch on the same project (no redeploy, no migration), but two Hobby ceilings bite exactly when traffic arrives: lower per-service resources (8 GB / 8 vCPU) and **community-only support with no response guarantee** (Pro adds ~72h support, higher limits, and the spend cap).

**Do now, while on Hobby (costs nothing, saves an incident later):**
- **Data-plane discipline from day one:** Postgres stays on Supabase; take an **independent, off-platform backup** (e.g. scheduled `pg_dump` elsewhere) before rollout. This neutralizes Railway's worst documented failure mode (on-platform backups were unreachable during the May 2026 outage).
- **Scope and rotate Railway API tokens tightly** (lesson of the PocketOS "one token = root" data-loss incident); never put irreplaceable state on Railway-managed volumes.
- Route all DB/egress over **private networking**.
- **Capture a baseline** while traffic is low — idle RAM/CPU per service and rough cost/day — so post-launch you can tell normal scaling from something misbehaving.

**At the moment of upgrading to Pro:**
- **Set the spend limit immediately** — this is the one feature that turns a surprise usage spike into "service pauses and pings me" rather than a surprise invoice. Define it before traffic comes.
- Confirm support tier and alerting are active before the announcement goes out.

## 16. Testing strategy [PROPOSED]

Goal: protect **everything** (record logic, the importer, user-facing flows, the moderator CMS, and the Phase-3 LLM pipeline) while keeping PR feedback **fast** and test-maintenance **low**. The shape that achieves both is a **fast required check** (unit/integration, blocks merge) plus **slower non-blocking checks** (E2E, visual, LLM evals) on preview deploys + nightly. CI = **GitHub Actions**.

**16.1 Framework mix**
- **Vitest** for unit + integration — it shares TanStack Start's Vite pipeline, so imports/aliases/TS resolve exactly as in the app. Extract the **record logic into pure functions** (supersede rule, completion-% math, per-mode logic) and table-test them exhaustively, including the boundary case that an **equal** score must *not* supersede. These are the highest-value, lowest-churn tests — written by hand.
- **PGlite (in-process WASM Postgres)** as the test DB for integration tests — real Postgres semantics, starts in milliseconds, no Docker. Push schema per test file via `drizzle-kit`'s `pushSchema`. Test Drizzle queries, constraints, the **migration importer**, and server-function *handlers* against it (mock `createServerFn` to a pass-through, or wrap in `runWithStartContext`).
- **Playwright** for E2E (chosen over Cypress: free parallelism + sharding, trace viewer, video/screenshots, multi-context for OAuth + multi-role). Keep E2E **thin** — a handful of critical flows, not a second copy of the unit suite.
- **Component tests:** Vitest + React Testing Library (jsdom) for logic; Vitest **Browser Mode** for the genuinely visual, CSS/layout-dependent components (parallax, glass) — used selectively.

**16.2 E2E auth without real Discord OAuth [LOCKED approach]**
A **seeded Supabase test user** signed in via the `supabase-js` SDK in a Playwright **setup project**, persisting the session with **`storageState`**; every test boots already authenticated. Separate `admin.json` / `user.json` states cover the moderator CMS vs public flows. **Never run real Discord OAuth per test; never commit tokens** (mint fresh in CI setup — signing-key rotation silently invalidates stored sessions).

**16.3 Test DB & environments**
- **PGlite** for the fast required check (default).
- **Migrations** validated on a fresh isolated DB — **Supabase branching** (per-PR ephemeral DB, auto-runs migrations) as a **required** check so a bad migration can't merge; run `drizzle-kit migrate` against the branch creds.
- **Full E2E** runs against a **Railway PR preview** (real app + isolated Postgres copy, torn down on merge).
- Isolation: fresh in-memory DB per test *file* (Vitest parallelizes by file); transaction-rollback-per-test where a shared DB is used.

**16.4 Keeping CI fast**
- **Required, ~2–4 min:** typecheck + lint + Vitest (unit + integration, PGlite, no service containers) → blocks merge.
- **Non-blocking** (on PR preview + nightly; gate on `main`/release): Playwright E2E, visual regression, LLM evals.
- **Playwright sharding** via the Actions matrix (`--shard`, `reporter: blob`) → a `merge-reports` job emits one HTML report.
- **Affected-test selection** (`vitest --changed`, `playwright --only-changed`); **cache** pnpm + Playwright browsers (key on Playwright version) + build artifact across shards.
- Stability defaults: `forbidOnly`, retries 2, `trace: on-first-retry`, `screenshot: only-on-failure`, `video: retain-on-failure`.

**16.5 "Hands-off" / auto-generated tests**
- **Meticulous** — records real sessions via a snippet (like the PostHog one we already run) and auto-maintains a covering, deterministic, **flake-free** replay suite with automatic network mocking → best fit for "focus on building, not maintaining tests." It isolates the frontend (mocks the backend), so it **complements, not replaces**, the Vitest logic tests and Playwright full-stack flows.
- **Playwright AI agents (v1.56) + codegen** — free, output standard Playwright code we own; good for scaffolding new flows and self-healing selectors.
- **Honest boundary:** auto-generation reduces maintenance for **UI/visual breadth and selector healing**, *not* for **business-rule correctness**. The supersede rule, completion math, importer edge cases, and the LLM "code disposes" boundary stay hand-written.

**16.6 Visual evidence**
- **Playwright `toHaveScreenshot()`** (free) for screenshots/recordings, with baselines generated **in the CI container** (macOS-vs-Linux rendering differs). Add **Argos** (Playwright-native, PR diffs, attaches traces) as the review dashboard if we want richer visual review; Chromatic/Percy are alternatives.

**16.7 LLM eval for the Phase-3 pipeline**
- Test the two halves separately, matching the "**LLM proposes, code disposes**" boundary:
  - **Deterministic boundary (code):** ordinary Vitest tests feeding **golden JSON** — including malformed/partial/wrong-type extractions — so a bad extraction can never corrupt records.
  - **Extraction quality (LLM):** a **labeled image golden set** scored on **field-level accuracy** *and* **schema-validity** (validity can be near-perfect while values lag — measure values, not just parseability).
- **promptfoo** (open-source, MIT, GitHub Action, caches responses) runs a **small golden set (~20–50 images) on PRs that touch the prompt/pipeline** (<5 min) and a **larger set nightly**, gating if accuracy/validity drops below threshold. Grow the set whenever a real production miss occurs; prefer the cheapest model that passes. (Optional: Braintrust as a hosted regression dashboard.) *Note: promptfoo is now OpenAI-owned but remains MIT/open-source — re-confirm that's acceptable.*

**16.8 Recommended layer → tool → when**

| Layer | Tool | When in CI |
|---|---|---|
| Static (types/lint) | `tsc`, ESLint | Every push — **required** |
| Unit (record logic) | Vitest (jsdom) | Every push — **required** |
| Integration (Drizzle/importer/server fns) | Vitest + PGlite | Every push — **required** |
| Migrations | drizzle-kit + Supabase branching | On PR — **required** |
| E2E flows | Playwright (storageState, sharded) | PR preview + nightly — non-blocking |
| Visual | Playwright screenshots + Argos | PR preview — non-blocking |
| Auto-maintained | Meticulous | PR preview — non-blocking |
| LLM eval | promptfoo (small PR / large nightly) | PR (pipeline paths) + nightly |

**16.9 Staged rollout**
1. **Week 1:** Vitest + PGlite; pure-function record-logic tests (supersede boundary, completion math); the required `quick-checks` job.
2. **Week 2:** integration tests for Drizzle/service/importer; Supabase branching as a required migration check.
3. **Week 3:** Playwright with SDK-login `storageState` (admin + user); 3–5 critical flows against the Railway preview; sharding + merged report; screenshots/Argos.
4. **Week 4:** Meticulous for auto-maintained breadth; promptfoo golden set gating the pipeline + nightly regression.
- **Triggers to adjust:** PR feedback > ~10–15 min → shard more / push E2E to nightly+preview; flaky rate > 2% → fix selectors/data before adding tests; if a managed auto-test tool underdelivers → fall back to Playwright AI agents + codegen (free, we own the code).
