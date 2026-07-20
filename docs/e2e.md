# E2E runbook (Playwright)

A thin suite — four flows, not a second copy of the unit tests — driving the **built SSR server** against a **disposable Supabase stack**. Lives in [`e2e/`](../e2e), configured by [`playwright.config.ts`](../playwright.config.ts).

| Spec                    | Covers                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| `public-browse.spec.ts` | `/` → `/grb`, the catalogue, a vehicle page, the coming-soon shell            |
| `search.spec.ts`        | search → result → detail page, and the empty state                            |
| `admin-gate.spec.ts`    | the CMS refuses signed-out visitors and signed-in non-moderators              |
| `admin-cms.spec.ts`     | a moderator edit persists across a reload **and** lands in the audit log      |

## Auth: SDK sign-in, no Discord OAuth

The app keeps its session in **httpOnly** cookies ([`src/auth/supabase-server.ts`](../src/auth/supabase-server.ts)), so a test cannot inject one into `localStorage`. The `setup` project instead:

1. Mints two auth users with the service-role key and pins their `profiles.role` (`e2e/support/users.ts`) — `profiles.id` **is** the Supabase `auth.users.id`.
2. Signs each in through `supabase-js`, capturing the cookies `@supabase/ssr` writes into a recording jar rather than hand-rolling Supabase's cookie naming/chunking/encoding (`e2e/support/session.ts`).
3. Saves them as `e2e/.auth/{admin,user,anon}.json` — **git-ignored, minted fresh every run**. A stored session is silently invalidated by a signing-key rotation, so it is never committed.

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

Playwright boots its own server on **port 3100**, deliberately not the dev server's 3000 — otherwise it would silently reuse a `bun run dev` pointed at different config, and you'd debug phantom failures.

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

**This workflow is non-blocking by design** — `continue-on-error`, and it must stay out of branch protection's required checks. `quick-checks` remains the gate.
