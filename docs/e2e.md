# E2E runbook (Playwright)

A thin suite — the flows worth driving end to end, not a second copy of the unit tests — driving, by default, the **built SSR server** against a **disposable Supabase stack**. (`PLAYWRIGHT_BASE_URL` points it at a server someone else is running instead; see below.) Lives in [`e2e/`](../e2e), configured by [`playwright.config.ts`](../playwright.config.ts).

| Spec                            | Covers                                                                    |
| ------------------------------- | ------------------------------------------------------------------------- |
| `public-browse.spec.ts`         | `/` → `/grb`, the catalogue, a vehicle page, the coming-soon shell        |
| `search.spec.ts`                | search → result → detail page, and the empty state                        |
| `admin-gate.spec.ts`            | the CMS refuses signed-out visitors and signed-in non-moderators          |
| `admin-cms.spec.ts`             | a moderator edit persists across a reload **and** lands in the audit log  |
| `admin-players.spec.ts`         | a moderator resets a reported avatar                                      |
| `avatar-owner.spec.ts`          | only the owner sees the avatar controls                                   |
| `profile-monument.spec.ts`      | the profile's monument, and its one amber moment on an unclaimed page     |
| `og-cards.spec.ts`              | every page unfurls, and the card routes serve real PNGs                   |
| `nav-pane.spec.ts`              | the nav pane rises with the reader's own scroll, not with a restored one  |
| `nav-touch-targets.spec.ts`     | every nav control reaches 44px, and the pane is no taller for it          |
| `nav-contrast.spec.ts`          | every ink in the nav clears 4.5:1 over the worst backdrop a page can give |
| `ink-contrast.spec.ts`          | every ink on the panes the nav floats over clears AA, in both modes       |
| `catalog-touch-targets.spec.ts` | every filter, sort and pager control on Browse reaches 44px               |
| `reach-helper.spec.ts`          | the reach measurement itself, against markup built to break it            |
| `catalog-status.spec.ts`        | the sync status endpoint answers the watchdog probe                       |

## Measuring contrast

`e2e/support/contrast.ts` is the only way this repo can answer "does that read?", because a pane is translucent glass over a lit scene and the ink carries its own alpha — neither side of the ratio exists until it renders, so no token and no stylesheet review can tell you.

`readInk` screenshots a clip **four** times, forcing the type transparent, then black, then white, then transparent again:

- the **transparent** shot is the backdrop beneath each glyph, which a shot with the type still painted could never show;
- **black against white** is the coverage each pixel actually receives, so only pixels the type really paints set the reading;
- the **second transparent** shot is the same frame as the first, and any pixel the two disagree on is dropped rather than believed. Vehicle art decoding mid-sequence would otherwise move the ground under the type and mark pixels no glyph ever touched. If that leaves nothing measured at all, the read is retried once and then fails with `would not hold still long enough to read`.

Text sliding under the nav or a pinned head paints nothing solid and is left unmeasured rather than guessed at — which is why the sweeps also assert, per route, that the sites they were run *for* produced a reading at all.

## Auth: SDK sign-in, no Discord OAuth

The app keeps its session in **httpOnly** cookies ([`src/auth/supabase-server.ts`](../src/auth/supabase-server.ts)), so a test cannot inject one into `localStorage`. The `setup` project instead:

1. Creates two auth users with the service-role key and pins their `profiles.role` (`e2e/support/users.ts`) — `profiles.id` **is** the Supabase `auth.users.id`. An existing user is left **untouched**: writing a password, even an identical one, makes GoTrue drop every session that user holds, which signs out any suite already running against the stack. `E2E_RESET_USERS=1` forces a reset when a password has genuinely drifted.
2. Signs each in through `supabase-js`, capturing the cookies `@supabase/ssr` writes into a recording jar rather than hand-rolling Supabase's cookie naming/chunking/encoding (`e2e/support/session.ts`).
3. Saves them as `e2e/.auth/{moderator,viewer,anon}.json` — **git-ignored, minted fresh every run**. A stored session is silently invalidated by a signing-key rotation, so it is never committed.

`anon.json` carries no session, only granted analytics consent, so the fixed consent banner never covers the page under test.

**Guard:** the setup refuses to run unless `SUPABASE_URL` *and* `DATABASE_URL` are local — it creates users and promotes a moderator, which must never touch production. `E2E_REMOTE=1` overrides it, mirroring the seed/import runners' `*_REMOTE` opt-ins.

## Running it locally

Needs Docker (for the Supabase stack) and the Chromium build:

```bash
bunx supabase start           # local Auth on :54321, Postgres on :54322
bun run db:migrate && bun run db:seed
bun run e2e:install           # Chromium, pinned to the installed Playwright
bun run test:e2e              # builds, boots the SSR server, runs the suite
```

Playwright boots its own server on **port 3100 + an offset derived from the checkout path**, deliberately not the dev server's 3000. The offset is what keeps worktrees off each other's ports; refusing to adopt an occupied one (below) is what stops a collision going unnoticed.

### One suite at a time per database

Worktrees that share a local Supabase stack share its users and its data, so `globalSetup` takes a Postgres **advisory lock** (`e2e/support/stack-lock.ts`) and holds it for the run. A second suite waits, printing a heartbeat every 15s naming the holder:

```text
⏳ waiting for the shared E2E stack — 1m15s (held by wt-records for 4m02s)
```

Silence for minutes therefore means wedged, not queued. The lock is released by the connection dropping, so a killed run cannot strand it, and it gives up after 15 minutes. Give each checkout its own stack and the lock is uncontended — one call, no wait.

That release-on-drop cuts both ways: if the connection dies mid-run the lock is free immediately, so the run takes it straight back. Only one session can hold it, and a waiter that takes it keeps it for the rest of its run — so regaining it proves nobody else got in, and failing to proves somebody did, at which point the run ends rather than reporting results it cannot stand behind. The overlap is bounded by the round-trip it takes to find that out, which no design avoids for a lock the server frees on disconnect: stopping dead on every drop would shorten the gap by one query while killing healthy runs whenever nothing was waiting. Losing sessions is no longer one of the risks, since the password write is gone whether or not the lock holds, but shared catalog and profile writes still are.

The lock is session-scoped, so `DATABASE_URL` must be a direct or session-pooler connection. A transaction pooler routes each statement to a different backend and would report the lock taken while holding nothing — only reachable via `E2E_REMOTE=1`, and the run aborts rather than proceeding unprotected.

The lock covers Playwright runs and nothing else. `db:seed`, `supabase db reset`, `catalog:sync` and a running dev server take no lock, so any of them can still walk over a suite in flight.

A `--ui` session holds the lock for as long as the window is open, so a sibling worktree's run will queue behind it and give up after 15 minutes. Close it when you're done.

Playwright never adopts a server already listening on the port (`reuseExistingServer: false`). A second suite in the same checkout, or the rare pair of checkouts whose ports collide, therefore fails loudly at boot instead of silently testing whichever branch got there first. To run a suite against a server you started yourself, point it there with `PLAYWRIGHT_BASE_URL`.

**`.env` must point at the local stack** — `SUPABASE_URL=http://127.0.0.1:54321`, not the hosted project, or the guard rejects the run. To override for a single run without editing `.env`:

```bash
eval "$(bunx supabase status -o env |
  sed 's/^API_URL=/SUPABASE_URL=/;s/^ANON_KEY=/SUPABASE_ANON_KEY=/;s/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/' |
  grep -E '^SUPABASE_' | sed 's/^/export /')"
bun run test:e2e
```

Explicitly exported vars beat `.env` — the config restores them after loading the file.

`PLAYWRIGHT_BASE_URL` points the suite at an already-running target (a server you started yourself, or a deployed preview) instead of letting Playwright boot one. The **app server must use the same Supabase project** the sessions were minted against, or every signed-in test falls through to the signed-out page.

Proof uploads need Cloudflare R2, so no test creates a record with an image proof; read paths degrade to no imagery when the `R2_*` vars are absent, which is how CI runs.

**If pages start returning 500s across the board**, check Postgres connections before suspecting the code — the local stack allows 100, each app server holds a pool, and killed servers do not always release theirs:

```sql
select count(*) from pg_stat_activity;
select pg_terminate_backend(pid) from pg_stat_activity
where application_name = 'postgres.js' and state = 'idle';
```

## CI

[`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) builds once, fans the bundle out to a **sharded matrix**, and each shard stands up its own `supabase start` + migrate + seed. Shards emit **blob** reports that `merge-reports` combines into one HTML artifact; failures also upload screenshots, traces and video.

**Advisory on a PR, enforced on `main`** — `continue-on-error` is set only for `pull_request` events, so a failing shard annotates the PR without blocking it, while the same failure on a push to `main` fails the run. Keep it out of branch protection's required checks either way; `quick-checks` is the gate.
