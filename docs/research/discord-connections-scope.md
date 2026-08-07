# Discord's `connections` OAuth scope — does it prove ownership of a YouTube, Twitch or TikTok account?

Research for [#166](https://github.com/Esk3tit/wt-records/issues/166). Serves [#157](https://github.com/Esk3tit/wt-records/issues/157) (creator links, impersonation posture) and follows the evidence discipline set by [#152](https://github.com/Esk3tit/wt-records/issues/152).

Fetched 2026-08-06.

**Evidence grades.** **[P]** = Discord's own developer documentation, fetched directly. The published site (`docs.discord.com/developers/…`) is a Mintlify SPA; its page source is the `.mdx` in Discord's own public repo `discord/discord-api-docs`, and both were fetched and cross-checked to agree. **[P·support]** = Discord's own end-user Help Centre — Discord's publication, but not developer documentation, and `support.discord.com` 403s non-browser clients so it was retrieved from a `web.archive.org` snapshot. **[S]** = secondary (third-party documentation, production code using the API, decompiled client strings). Unverified items are named in *What stays unverified*, not smoothed over.

---

## Bottom line

**Partially — and the part that works is real.**

For **YouTube** and **Twitch**, `GET /users/@me/connections` with the `connections` scope returns a `verified: true` connection whose `id` is the platform's own immutable account identifier, established by the user completing a real login on that platform's site. That is a genuine ownership proof, obtained through a provider WT Records already uses, at zero marginal cost and with no moderator in the loop.

For **TikTok**, the connection *type* exists and is user-addable, but nothing in Discord's documentation says what `id` and `name` hold for it, and no real TikTok payload was found. Treat TikTok as unproven.

The check is **one-directional and cannot be required**. A false negative is cheap and common (user simply hasn't linked the account on Discord, or declines the scope), so it can power a *positive* badge — "ownership confirmed via Discord" — but never a gate. It also does not survive past the login request without extra work: Supabase deliberately discards the Discord provider token, so this is one-shot at sign-in unless the app captures and stores it itself.

---

## 1. The endpoint and the response shape

**`GET /users/@me/connections`** — *"Returns a list of connection objects. Requires the `connections` OAuth2 scope."* **[P]** (`developers/resources/user.mdx`, "Get Current User Connections"; verbatim on the published page.)

**Scope definition:** `connections` — *"allows `/users/@me/connections` to return linked third-party accounts"* **[P]** (`developers/topics/oauth2.mdx`, OAuth2 scopes table). A second Discord page phrases the same scope as *"View the user's linked accounts (Twitch, Steam, etc.)"* **[P]** (`developers/platform/oauth2-and-permissions.mdx`).

**Connection Structure** — the complete documented object **[P]**:

| Field | Type | Discord's description (verbatim) |
|---|---|---|
| `id` | string | id of the connection account |
| `name` | string | the username of the connection account |
| `type` | string | the *service* of this connection |
| `revoked?` | boolean | whether the connection is revoked |
| `integrations?` | array | an array of partial server integrations |
| `verified` | boolean | **whether the connection is verified** |
| `friend_sync` | boolean | whether friend sync is enabled for this connection |
| `show_activity` | boolean | whether activities related to this connection will be shown in presence updates |
| `two_way_link` | boolean | whether this connection has a corresponding third party OAuth2 token |
| `visibility` | integer | *visibility* of this connection |

`verified` and `visibility` are **not** marked optional — they are always present. `revoked` and `integrations` are optional.

**Discord publishes no example response for this endpoint** — the "Get Current User Connections" section is three lines with no JSON sample, and no sample connection object appears anywhere in `discord-api-docs`. **[P, by absence]** The nearest thing to a concrete payload is third-party:

```jsonc
// [S] discord-userdoccers (docs.discord.food), "Example Connection" — a reddit connection
{
  "type": "reddit", "id": "run&hide", "name": "alien",
  "visibility": 1, "friend_sync": false, "show_activity": true,
  "verified": true, "two_way_link": false,
  "metadata_visibility": 1, "metadata": { … },
  "revoked": false, "integrations": []
}
```

Note that sample carries two fields Discord does not document (`metadata`, `metadata_visibility`) — userdoccers documents the *client* API surface, which is a superset. It also records that `access_token` is *"Not included when fetching a user's connections via OAuth2"* **[S]**, i.e. the OAuth view is narrower than the client view. Do not code against undocumented fields.

## 2. Which platform types are covered

Discord's full enumerated **Services** list **[P]**, verbatim values:

`amazon-music`, `battlenet`, `bungie`, `bluesky`, `crunchyroll`, `domain`, `ebay`, `epicgames`, `facebook`, `github`, `instagram`\*, `mastodon`, `paypal`, `playstation`, `reddit`, `roblox`, `spotify`, `skype`\*, `steam`, **`tiktok`**, **`twitch`**, `twitter`, `xbox`, **`youtube`**

\* *"Service can no longer be added by users"* — applies to `instagram` and `skype` only. **[P]**

So **YouTube, Twitch and TikTok are all present and all still user-addable**, as are Steam, Bluesky, X (`twitter`), Reddit and GitHub. Against #157's initial ten, the misses are **Telegram** and **Kick** — neither is a Discord connection type — and **Discord server invites**, which are not a connection at all.

**This list is not stable, and Discord removes types from this endpoint.** On 2026-07-07 Discord announced that Riot Games / League of Legends connections *"are no longer returned by the `/users/@me/connections` endpoint"*, and that from **2026-07-10** legacy ones would stop being returned too, with *"no replacement for this functionality"* **[P]** (`developers/change-log.mdx`). Both types are still listed in userdoccers' client-side enum but are already absent from Discord's own public Services table. Any code here must treat a missing type as normal.

## 3. What `id` and `name` actually hold

**Discord documents nothing per type.** The only text is the generic *"id of the connection account"* / *"the username of the connection account"* **[P]**. There is no per-service table, no example, and no statement of stability or mutability. **This is the single biggest documented gap in the feature.**

What can be established from production code that consumes the endpoint:

- **YouTube `id` is the channel ID (`UC…`).** `sendou.ink` — a live competitive-Splatoon site — reads `connection.id` for `case "youtube"` and stores it as `youtubeId`; `project-kiyo`'s YouTube-subscriber-role command takes `youtubeConnection.id` as `channelId` and builds `https://youtube.com/channel/${channelId}` from it directly. **[S]**, two independent codebases. This is exactly the identifier #152 recommended carrying and #157 declined to fetch — here it arrives free.
- **Twitch `name` is the login.** `sendou.ink` reads `connection.name` for `case "twitch"` and stores it as the user's Twitch handle — and pointedly does *not* use `id` for it. **[S]**
- **Twitch `id` is presumed the numeric Twitch user ID** — consistent with the fact that `name` is used for the handle, and with the Twitch numeric ID (`"92473777"`) appearing in Discord's own integration-account shape — but **no direct evidence was found**. **[unverified]**
- **TikTok `id` / `name`: no evidence at all.** No documentation, no payload, no consuming code found. **[unverified]**
- **Bluesky `name` is the handle** (`sendou.ink`, same switch). **[S]**

**A real caveat on `name`.** userdoccers documents `PATCH /users/@me/connections/{type}/{id}` accepting a `name` parameter, with the qualifier *"Not all connection types support all parameters"* **[S]**. If `name` is user-settable for a given type, then `name` is a label and `id` is the fact. Prefer `id` wherever the platform's canonical URL can be built from it (YouTube: `/channel/UC…`); where it cannot (Twitch, whose public URL is `twitch.tv/<login>`), treat the pairing as verified-at-a-point-in-time rather than permanent. Whether `name` is in fact mutable for `twitch`/`youtube` is **unverified**.

## 4. `verified` — what it actually attests

Discord's developer docs define `verified` as *"whether the connection is verified"* and nothing more. **[P]** — circular, and the whole value of this ticket rides on it. The substance comes from Discord's Help Centre:

- **Adding a connection is an authenticated third-party login, not a text field.** For YouTube: *"Locate the **YouTube tile**, and then tap on it. This will open a new browser window where you can log into your YouTube account."* **[P·support]**
- Discord states this explicitly as the anti-fake-account mechanism: *"Adding Connections helps verify your account further. In order to add a Connection, you have to have the correct login and authenticate through any security protocols on the third party website."* **[P·support]**
- **`verified` is not automatic per type.** For payment providers, *"Having just a credit card or debit card on file will not qualify you for the 'verified' status."* **[P·support]** So `verified` carries a per-service meaning and must be checked, never assumed.
- The one type with a documented non-OAuth proof is `domain`, verified by a DNS `TXT` record at `_discord.<domain>` or a file at `https://<domain>/.well-known/discord` **[S]** — which shows the flag genuinely tracks a proof step rather than a self-declaration.
- `two_way_link` — *"whether this connection has a corresponding third party OAuth2 token"* **[P]** — is a second, stronger signal (Discord holds a live token for the account), but it is documented too thinly to build on.

**A limit worth recording.** Discord does not treat a connection as exclusive: *"A Connection can only be added to other Discord accounts after a certain period of time. This prevents bad actors from using one social media account to verify a bunch of fake profiles."* **[P·support]** So one YouTube channel can end up verified on more than one Discord account, just not instantly. A Discord-verified link is therefore evidence of *access*, not of *sole ownership* — #157's unique index on `(platform, handle)` still does necessary work.

**Reading, on balance:** for `youtube` and `twitch`, `verified: true` means *this Discord user completed a real login at that platform*. That is a materially stronger claim than a typed handle. It is inference from Discord's support copy, not a developer-doc statement — graded accordingly.

## 5. Can the user hide connections from the app?

**Yes, in two ways, and one of them is invisible to us.**

**Visibility types** **[P]**: `0` = *"invisible to everyone except the user themselves"*; `1` = *"visible to everyone"*. The user toggle is *"display on profile"*: *"You can also hide the connection completely by toggling off 'display on profile'."* **[P·support]** A separate toggle, *"display details on profile"*, controls only the metadata — *"Other members of the server will still be able to see that you are verified with that Connection, but your personal information associated with that Connection will not be visible."* **[P·support]**

**Does `visibility: 0` still come back over OAuth?** Discord does not say. **[P gap]** The evidence says yes:

- The `visibility` field is returned in the OAuth response at all, which is pointless if the value is always `1`. **[P, inference]**
- `sendou.ink` filters incoming OAuth connections with `if (connection.visibility !== 1 || !connection.verified) continue` — dead code unless `0` is observed in production. **[S]**
- A third-party connections viewer states plainly that with the scope granted it *"can access their full connections list… This may reveal connections they've set to hidden in Discord, since discord.dog requests the `connections` OAuth scope."* **[S]**

**Design consequence, and it cuts both ways.** If hidden connections *are* returned, then reading them is a privacy surprise — the user hid that link on Discord and we surfaced it on their WT Records profile. **Filter on `visibility === 1 && verified === true`** regardless of what the API returns: it is the conservative reading, it matches what a production peer does, and it is correct under either answer.

**The false-negative paths, in full.** A legitimate creator fails this check when they: (a) never linked the platform on Discord; (b) linked it but toggled *display on profile* off; (c) signed in with Google instead of Discord; (d) declined the `connections` scope; (e) had the connection revoked (`revoked: true`) or the type withdrawn by Discord. None of these are rare. **A missing verified connection means nothing at all** — it must never downgrade a link, only the presence of one may upgrade it.

## 6. The consent screen, and re-prompting

**Shape of the dialog** — from Discord's own screenshot in the linked-roles tutorial **[P]** (`images/linked-roles-consent-dialog.webp`): *"An external application / **{App name}** / wants to access your Discord account"*, *"Signed in as {user}"*, then a heading *"THIS WILL ALLOW THE DEVELOPER OF {APP} TO:"* followed by one green-ticked row per scope — in that screenshot, *"Access your username, avatar, and banner"* (`identify`) and *"Update your connection and metadata for this application"* (`role_connections.write`) — then Cancel / Authorize.

**The `connections` row text** is *"Access your third-party connections"*, with an empty state *"You don't have any third-party connections yet!"* **[S]** — Discord's own product strings, but taken from a third-party mirror of a decompiled **Discord Android 8.6.8 (2019)** `strings.xml`. That build's `identify` string reads *"Access your username and avatar"*, whereas Discord's current screenshot reads *"…username, avatar, and banner"*, so **the wording has demonstrably moved since** and the `connections` line may have been reworded too. The existence of a dedicated *empty* string strongly implies the dialog **enumerates the user's actual connections inline** — i.e. the user sees exactly which linked accounts they are handing over before clicking Authorize. That is good for consent and bad for conversion; it is also **unverified for the current web client**.

**Does adding the scope re-prompt existing users? Yes, effectively always.** Discord: *"`prompt` controls how the authorization flow handles existing authorizations. If a user has previously authorized your application with the requested scopes and prompt is set to `consent`, it will request them to reapprove their authorization. If set to `none`, it will skip the authorization screen and redirect them back… without requesting their authorization."* **[P]** The default is `consent` **[S]** (userdoccers; Discord's own docs do not state the default), and `none` *"requires previous authorization with the requested scopes"* **[S]** — so it cannot silently cover a newly added scope in any case. Adding `connections` therefore puts an authorization screen in front of every returning user; whether it also breaks any silent-reauth path depends on whether Supabase sends `prompt`, which it does not appear to.

**No approval gate found.** Discord's docs describe no verification, allow-list or review for the `connections` scope — the only stated requirement is that scopes *"must be declared in the Developer Portal"* **[P]**. This is an absence of evidence in the docs, not a positive statement that no gate exists.

## 7. Rate limits, token lifetime, and whether this is one-shot

- **Global limit:** *"All bots can make up to 50 requests per second to our API… If no authorization header is provided, then the limit is applied to the IP address."* **[P]** Limits are keyed on the request's authentication, so a per-user bearer token gets its own budget — one call per sign-in is nowhere near any ceiling.
- **Per-route bucket for `/users/@me/connections`: not published.** **[P gap]** Discord documents per-route limits only via response headers (`X-RateLimit-Limit`, `-Remaining`, `-Reset`, `-Bucket`), and *"rate limits… can change at any time"*, so they must be read at runtime rather than hard-coded. **[P]**
- **Invalid-request ban:** *"IP addresses that make too many invalid HTTP requests are automatically and temporarily restricted… Currently, this limit is **10,000 per 10 minutes**"*, counting 401/403/429. **[P]** Relevant only if expired tokens get retried in a loop.
- **Token lifetime:** the documented access token response carries `"expires_in": 604800` — **7 days** — plus a `refresh_token`; refreshing is a `POST` to the token URL with `grant_type=refresh_token`. **[P]**
- **So: one-shot at login unless we deliberately make it otherwise.** Re-checking later requires storing the refresh token and running the refresh grant ourselves. Given #157's stated position that *"a link is a claim about the world, and claims go stale"*, one-shot-at-login with a stored timestamp is the proportionate design, and it avoids holding a long-lived third-party credential.

## 8. What this costs us on Supabase — the real integration constraint

The site starts the Discord flow through Supabase (`src/routes/auth/login.ts`, `signInWithOAuth({ provider: 'discord' })`) with **no `scopes` option set today**.

- `signInWithOAuth` accepts `options.scopes` (Supabase's own example passes `'repo gist notifications'`). **[P·supabase]**
- **Supabase does not keep the provider token:** *"Provider tokens are intentionally not stored in your project's database."* **[P·supabase]** And: *"Supabase Auth does not manage refreshing the provider token for the user. Your application will need to use the provider refresh token to obtain a new provider token."* **[P·supabase]** Community reports have both `provider_token` and `provider_refresh_token` becoming `undefined` after the initial session. **[S]**
- **Therefore the call must happen in `/auth/callback`**, server-side, in the same request that exchanges the code — read `session.provider_token`, call `GET /users/@me/connections`, persist the derived facts (not the token), discard the token. That fits the existing server-side callback route cleanly and never exposes the token to the browser.

Cost of the whole thing: one extra scope string, one HTTPS call inside a route that already exists, and no new provider, table-of-secrets, or queue. That is the ticket's premise, and it holds.

## 9. Is there anything comparable on the Google side?

**No — Google has no equivalent, and the near-miss is a false friend.**

- Google publishes no API that lists a user's linked third-party accounts. The People API resource literally named `connections` is the user's **contacts**: *"Provides a list of the authenticated user's contacts."* **[P·google]** It is unrelated.
- The only Google-side ownership proof is **YouTube-only and per-platform**: `channels.list` with `mine=true` — *"Set this parameter's value to `true` to instruct the API to only return channels owned by the authenticated user."* **[P·google]** — which yields the authenticated user's own `UC…` channel ID.
- **Cost: effectively free.** `channels.list` *"has a quota cost of 1 unit"* against a default **10,000 units/day** **[P·google]**. Google does not state a price on those pages; there is no per-call charge for YouTube Data API v3 within quota. Practically unlimited at our volume.
- **Scope:** `https://www.googleapis.com/auth/youtube.readonly` — *"View your YouTube account"* **[P·google]**.
- **The catch is process, not money.** Requesting a YouTube scope means Google's OAuth app verification: *"Apps that request access to scopes categorized as sensitive or restricted must complete Google's OAuth app verification."* **[P·google]** Whether `youtube.readonly` is classified sensitive is **unverified** — Google's classification list was not reached. If it is, the Google path costs a review cycle, a privacy policy, a verified domain and a re-consent, versus Discord's one added scope string. And it proves **only YouTube**; it says nothing about Twitch or TikTok.
- Twitch retains its own free ownership path independent of all this — #152 recorded that Helix `GET /helix/users?login=` returns the permanent numeric ID with an app token and no scopes **[P, per #152]** — but that resolves a handle, it does not prove who holds it.

**Comparison, plainly:** Discord is one scope on an existing login and covers three platforms at once. Google is a verification process for one platform. If any verification ships, it should be the Discord one.

---

## What this changes for #157

1. **The `UC…` channel ID that #157 declined to store is available free.** #157 rejected carrying immutable IDs because doing so *"buys a live third-party API call on every write."* That objection does not apply here: the ID arrives on the login the site already performs, at write-time-zero, and no YouTube API is involved. The decision is worth revisiting **for YouTube specifically**, on the narrow grounds that its cost basis changed.
2. **The posture can go from *mitigated* to *mitigated + selectively checked*.** A verified match earns a positive affordance; the absence of one changes nothing. It cannot be a gate — see the five false-negative paths in §5.
3. **Match on `id`, display the handle.** For YouTube, compare the stored handle's channel against `connection.id`; for Twitch, `connection.name`. The rendered handle stays exactly as #157 specified — it is still the anti-impersonation signal.
4. **The unique index still earns its place.** Discord permits the same third-party account on multiple Discord accounts after a cooldown **[P·support]**, so "verified" is not "sole".
5. **The consent cost is real.** Adding `connections` re-prompts every returning user, and the dialog appears to enumerate their linked accounts. That is a product decision, not a technical one.

## What stays unverified

Named, not smoothed over.

- **No response payload was ever observed.** Every statement about what a real `youtube` / `twitch` / `tiktok` connection object looks like is documentation plus third-party consuming code. **No Discord app was registered and no OAuth flow was run** — this research had no Discord credentials. One 15-minute empirical run against a real account would convert most of the items below from `[S]` to `[P]`.
- **Discord documents nothing about `id`/`name` per service type.** The `UC…` claim for YouTube rests on two independent third-party codebases, not on Discord. **Twitch's `id` being the numeric user ID is unverified.** **TikTok's `id` and `name` are entirely unknown** — no doc, no payload, no consuming code found. TikTok's handle grammar was already unverified in #157; this does not fix it.
- **Whether `visibility: 0` connections are returned over OAuth is not stated by Discord.** Inferred from the field's presence and from a production peer filtering on it. The recommendation (filter to `visibility === 1`) is correct either way, so this gap does not block a decision.
- **The exact `connections` consent-screen wording in the current client.** The verbatim string quoted is from a 2019 decompiled Android build whose sibling strings have since changed. Whether the dialog enumerates the user's individual connections inline is inferred from an empty-state string, not observed.
- **Whether Discord's default `prompt` is `consent`** is from userdoccers, not from Discord — Discord's docs state the *behaviour* of each value but never the default.
- **Whether `name` is user-mutable for `youtube` / `twitch`.** userdoccers documents a `PATCH` that accepts `name` with the caveat that types differ. If it is mutable, `name` must never be the matched field.
- **No per-route rate limit** is published for `/users/@me/connections`; only the 50 req/s global. Must be read from response headers.
- **Google's sensitivity classification for `youtube.readonly`.** Google's scope list gives the description but not the class; the classification list itself was not reached, so the size of the Google verification burden is unmeasured.
- **`support.discord.com` 403s all non-browser clients.** Every `[P·support]` quote came from a `web.archive.org` snapshot (the Connections article snapshot is dated to a 2024-03-15 revision; the YouTube one to 2025-06-10). Current wording may differ. The `chrome-devtools-axi` path was not needed for anything decision-relevant, since the archived text was sufficient and is quoted verbatim.
- **Whether the `connections` scope carries any Discord-side review or allow-list.** Nothing in the docs says it does; that is an absence, not a confirmation.

## Sources

- **[P]** `docs.discord.com/developers/resources/user` — Connection Object, Services, Visibility Types, Get Current User Connections. Cross-checked against `raw.githubusercontent.com/discord/discord-api-docs/main/developers/resources/user.mdx`.
- **[P]** `docs.discord.com/developers/topics/oauth2` — scope table, `prompt`, token/refresh grants, `expires_in`.
- **[P]** `docs.discord.com/developers/platform/oauth2-and-permissions` — scope summary table.
- **[P]** `docs.discord.com/developers/topics/rate-limits` — global 50 req/s, headers, 10,000-invalid-per-10-min.
- **[P]** `discord-api-docs` change-log, 2026-07-07 — Riot Games connections removed from the endpoint.
- **[P]** `discord-api-docs` `images/linked-roles-consent-dialog.webp` — consent dialog layout and scope-row phrasing.
- **[P·support]** Discord Help Centre, *Connections & Linked Roles: Community Members* and *How to Connect Your YouTube Channel to Discord* (via web.archive.org).
- **[P·google]** `developers.google.com/youtube/v3/docs/channels/list`, `/determine_quota_cost`, `/identity/protocols/oauth2/scopes`, `/people/api/rest/v1/people.connections/list`; `support.google.com/cloud/answer/13463073`.
- **[P·supabase]** `supabase.com/docs/guides/auth/social-login`, `supabase.com/docs/reference/javascript/auth-signinwithoauth`.
- **[S]** discord-userdoccers, `pages/resources/connected-accounts.mdx` and `pages/topics/oauth2.mdx`.
- **[S]** `sendou-ink/sendou.ink`, `app/features/auth/core/DiscordStrategy.server.ts` — production consumer; scope set, `visibility`/`verified` filter, per-type field choice.
- **[S]** `KIO2gamer/project-kiyo`, `src/features/youtube-subscriber-roles/commands/ytSubRole.js` — `connection.id` → `youtube.com/channel/…`.
- **[S]** Decompiled Discord Android 8.6.8 `res/values/strings.xml` (third-party mirror) — `scope_connections` strings.
- **[S]** `discord.dog/blog/discord-connections-viewer` — claim that the OAuth scope surfaces hidden connections.
