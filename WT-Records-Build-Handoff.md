# WT Records — Build Handoff Brief

> Companion to **`GRB-Records-PRD.md`** (the source of truth). This is the "what to do first" runbook for the **Claude Code → Impeccable → Claude Design** sequence. It references PRD sections rather than restating decisions — when in doubt, the PRD wins.

---

## 0. Orientation (read first)

- **Source of truth = the PRD.** This brief turns §5 (architecture), §6 (routes), §9 (schema), §16 (testing), and §8 (design tokens) into concrete first PRs. Don't re-litigate locked decisions — build them.
- **Sequence, and why it's this order:** **scaffold → design system → compose.** Each step consumes the previous one's output. Scaffolding produces real components + tokens; Impeccable systematizes them into `DESIGN.md`; Claude Design's `/design-sync` builds the landing page from those locked primitives. Designing before the system exists is what burns tokens and yields the templated look.
- **Stack:** TanStack Start (React, SSR, file routing) · Supabase (Postgres, Auth = Discord + Google, Storage, Realtime) · Drizzle ORM (drizzle-kit) · Railway (Hobby → Pro at launch) · Cloudflare in front · Sentry + PostHog.
- **Phase 1 scope only:** public **read** site + one-time **GRB migration** + a minimal **mod CMS**. No public `/submit`, no Phase-3 pipeline yet (schema is ready for them).

---

## 1. Provision before coding (accounts & services)

- [ ] GitHub repo (private to start) + branch protection on `main`
- [ ] Supabase project **and** local CLI/Docker stack (`supabase init` / `supabase start`)
- [ ] Railway project (Hobby) — set a **spend limit** now (§15)
- [ ] Discord OAuth app (client id/secret → Supabase Auth)
- [ ] Google OAuth app (client id/secret → Supabase Auth)
- [ ] Sentry project (web + workers) and PostHog project (session replay on)
- [ ] Domains: `wtrecords.gg` (canonical) + `recordswt.com` (301 → canonical), `rel=canonical` to `.gg` (§13)
- [ ] (Catalog-sync task) plan to **self-host** the WT Vehicles API — verify **GPL-3.0, not AGPL**, keep attribution (§10)

---

## 2. Phase A — Scaffold (Claude Code)

Build in small PRs so the fast CI check stays meaningful.

### PR1 — Repo & toolchain
- [ ] Init TanStack Start (React SSR, file-based routing); pnpm; TypeScript strict; ESLint
- [ ] Vitest config: a jsdom project (unit) + a node project for PGlite integration
- [ ] GitHub Actions **required** check: `typecheck + lint + vitest` (target 2–4 min, blocks merge) — §16
- [ ] `.env.example`, README (quick start < 5 min), folder structure

### PR2 — Data layer (§9)
- [ ] Drizzle + drizzle-kit wired to Supabase Postgres
- [ ] `schema.ts` = the §9 tables: `modes`, `mode_min_kills`, `nations`, `vehicles`, `vehicle_br`, `players`, `player_aliases`, `records`, `record_proof`, `profiles`, `audit_log` (+ enums `branch`, `vehicle_class`, `record_status`, `role`, `proof_kind`)
- [ ] First migration; confirm the **partial unique index** (`one current record per (vehicle, mode)`) applies
- [ ] **PGlite test harness** (`drizzle-kit pushSchema` per test file)
- [ ] **Write the correctness tests first** (pure functions): supersede rule incl. the **equal-does-not-supersede** boundary, completion-% math, per-(mode,class) min-kills + `difficultMinKills` override
- [ ] Seed: the **5 moderators** by hand (`profiles.role`), the `modes` row for **GRB** (`isLive=true`) + its `mode_min_kills`, and a **small real GRB slice** (a nation or two of records) so design has real data to render
- [ ] RLS: `anon` read policy exposing only `verified`/`isCurrent` records (§9.2)

### PR3 — Read routes (§6)
- [ ] File-based routes from the §6 tree (mode-prefixed: `/$mode`, `/$mode/nation/$slug`, `/$mode/vehicle/$slug`, `/$mode/leaderboard`, `/player/$slug`, `/rules/$mode`, `/admin` stub)
- [ ] SSR loaders via Drizzle **service role** (RLS-bypassing reads)
- [ ] The §9.1 derived views: `player_stats`, `global_stats`, `nation_stats`, `leaderboard` (plain views to start)
- [ ] Render **minimal / near-unstyled** — this is the substrate Impeccable will systematize, so don't hand-polish yet
- [ ] Names display per §6: primary = live `displayName`; secondary = `ignSnapshot` + `displayNameSnapshot` (collapse when all equal)

### Cross-cutting (from the first commit)
- [ ] Sentry + PostHog (with the consent banner; replay after opt-in) — §5
- [ ] Catalog-sync job (self-hosted WT Vehicles API → `vehicles` + `vehicle_br`) as its own task/cron
- [ ] **Defer to later phases:** `/submit`, full migration importer run, Realtime polish, Phase-3 pipeline

---

## 3. Phase B — Design system (Impeccable)

Run after PR3 exists (it needs real components to extract from).

- [ ] Install: `npx impeccable install` → `/impeccable init`
- [ ] **Feed the locked tokens at `init` (don't let it invent a palette):**
  - **Register:** hybrid — landing page = **brand** register; leaderboard / nation sheets / vehicle pages / admin = **product** register
  - **Audience:** the War Thunder records community
  - **Voice (pick 3):** e.g. *precise · competitive · premium* — Khai to finalize
  - **Tokens (from §8):** accent amber `#F0B94A`, base `#0a0c10`, frosted-glass materials (backdrop blur + saturate, hairline `rgba(255,255,255,.16)` borders, inset top highlight), **tabular numerics**, 22–26px radii, system font stack
  - **Anti-references (name them so it avoids the slop):** Inter-everywhere, purple→blue gradients, generic SaaS card-in-card, gray-on-color text
- [ ] `/impeccable document` → `DESIGN.md`; `/impeccable extract` to pull tokens/components out of PR3
- [ ] Optional: `npx impeccable detect src/` as a **non-blocking** CI check
- [ ] Polish passes on the real screens: `/impeccable audit` then `polish` on the leaderboard + a nation sheet

---

## 4. Phase C — Compose & polish (Claude Design)

- [ ] From Claude Code, `/design-sync` to import the Impeccable `DESIGN.md` system; review each section; **Publish/lock** it so output uses your primitives, not defaults
- [ ] Build the **landing page + hero** (with the §8.1 spatial-scene background) by composing locked components by name
- [ ] Iterate on the canvas, then **hand back to Claude Code** to ship from the synced system
- [ ] Token-burn guard: never start Claude Design cold — the locked system is what keeps usage (and generic output) down

---

## 5. Spatial-scene background (parallel, non-blocking — §8.1)

- [ ] **Offline:** subscribe to **Immersity AI** one month (~$5, commercial rights), batch the **curated shortlist** (the verified light/dark picks from the screenshot review), export **depth-map PNGs**, cancel. Fallback model: Depth Anything V2 **Small** (Apache-2.0).
- [ ] **Runtime:** lightweight WebGL / R3F depth-displacement shader (offset UV by `depth.r × pointer/gyro`); glass UI as DOM **above** the canvas
- [ ] **a11y/perf:** `prefers-reduced-motion` off-switch, static fallback where WebGL absent, clamp displacement to a few %
- [ ] **IP:** credit creators; keep the non-commercial posture; abstract-gradient fallback ready if monetized (§8.2)

---

## 6. Verify at build time (the §12 residuals — not blockers, but don't forget)

- [ ] Are the sheet's proof cells actually **hyperlinked**? (decides the Imgur URL-extraction path; §10)
- [ ] Datamine field → `class` mapping; authoritative `isDifficult` list; `mode_min_kills` + `difficultMinKills` values
- [ ] Fuzzy-match rules for sheet → vehicle reconciliation (emoji/symbol prefixes, duplicate names across nations)
- [ ] Does the WT Vehicles API expose **per-mode BR**? (feeds `vehicle_br`)
- [ ] Re-confirm Gaijin's fan-content terms **before** any monetization (§8.2)

---

## 7. Kickoff prompt (paste into the Claude Code session)

> Building **WT Records**, a War Thunder world-records site. The full spec is in **`GRB-Records-PRD.md`** and the build plan is in **`WT-Records-Build-Handoff.md`** — both are the source of truth; follow their locked decisions, don't re-derive them.
>
> Stack: TanStack Start (React SSR, file routing) + Supabase (Postgres, Auth = Discord + Google, Storage, Realtime) + Drizzle (drizzle-kit) + Railway, CI on GitHub Actions.
>
> Start with **PR1** from the handoff: initialize the TanStack Start project with pnpm + strict TypeScript + ESLint, set up Vitest (jsdom unit project + a node project for PGlite integration), add the GitHub Actions required check (typecheck + lint + vitest), and scaffold the folder structure + README + `.env.example`. Then stop and show me the plan for PR2 (the §9 Drizzle schema) before writing it.
>
> Keep the fast CI check fast; defer everything not in Phase 1 (no `/submit`, no Phase-3 pipeline yet). Set up testing from the first commit, not retrofitted.
