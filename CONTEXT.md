# WT Records

Public, server-rendered world-record registry for War Thunder — most kills in a single life, per vehicle, **per game mode**. This glossary fixes the project's vocabulary; the identity cluster especially (User / Profile / Player / Alias) is easy to conflate and is defined precisely here.

## Language

### Identity

**User**:
The canonical, stable account identity — one `auth.users` row. One person is one User even when both Discord and Google are linked to it.
_Avoid_: account, login.

**Profile**:
The account-level row, 1:1 with a User; carries `role` and convenience handles. Exists only once someone logs in (Phase 2).
_Avoid_: account, user record.

**Player**:
A record-holder identity — the thing that holds Records. Exists with **no User** by default (accountless is a permanent, valid state for migrated holders); links to a User only when **claimed**.
_Avoid_: account; "user" (a Player may have no User).

**Holder**:
The Player who holds a given Record. A relational role, not a separate entity.

**Claim**:
The act of a logged-in User linking a Player to themselves (sets the account link), which also ties that Player's existing Records to the User. Required only to submit.

**Merge** (Players):
Collapsing duplicate Player rows for the same person into one survivor: Records repoint, the duplicate's names become survivor Aliases, and the duplicate leaves a tombstone redirecting its old page. Records' Snapshots never change. Players claimed by **different** Users are never mergeable — two claims are two people (the User is the identity source of truth); same-User claims are.

**Alias**:
A name a Player has gone by — an in-game name or a former display name. Powers "previously known as".

**IGN** (in-game name):
The name shown on a War Thunder scoreboard. Distinct from a Player's site display name.

**Display name**:
A Player's current chosen site name — the **primary** name shown everywhere (record rows, leaderboard, profile). Updates on rename.
_Avoid_: username, current name.

**Snapshot** (IGN snapshot / display-name snapshot):
Immutable names frozen on a Record at submission — the at-the-time context shown as secondary on a record row. Never change on rename.

### Records

**Mode**:
A War Thunder game mode (GRB, GAB, ARB, AAB, …) — the top dimension. Each Mode is a self-contained world: its own leaderboard, completion, nation sheets, and rules. **Data, not an enum.**

**Record**:
A (vehicle, Mode) single-life kill achievement by a Player. One verified **Current record** per (vehicle, Mode), plus superseded history.
_Avoid_: entry, score.

**Current record**:
The one verified Record per (vehicle, Mode) that holds the title. A Record may be current only if verified.
_Avoid_: active record.

**Supersede**:
Taking the title by **strictly exceeding** the Current record's kills. An equal score does **not** supersede (first-to-achieve keeps it).
_Avoid_: beat, tie, overwrite.

**Submission**:
A Record with `status = pending` (Phase 2). Not a separate entity — a submission *is* a pending Record.

**Proof**:
An artifact attached to a Record — a scoreboard / end-game / end-life screenshot, or a video. All proof is modeled uniformly (no separate scalar video field).

**Retire**:
Soft-invalidating a once-verified Record (debunked proof, cheating, bad entry). The Record and its Proof are kept for history and audit but leave every public surface and aggregate; the title recomputes (next-best Record becomes Current, else Open bounty). Reversible.
_Avoid_: delete; reject (a Submission that was never accepted).

**Migrated record**:
A Record imported from the community's original spreadsheet rather than submitted through the site. Verified by definition (the sheet was moderated), holdable by an accountless Player, and backdated when its proof's upload time is known — shown simply as "migrated" when it isn't.

**Record date**:
The official date of a Record — the moment it was **verified** (approved), not when the run happened or was submitted. Migrated records are backdated to their historical approval (approximated by proof upload time).
_Avoid_: achieved date, submission date (as the record's date).

**Verifier**:
The moderator who verified a Record (`verifiedById`) — shown only in /admin, never publicly. While intake stays on Discord (Phase 1), the mod who enters a record *is* its Verifier; a distinct approve step arrives with Submissions (Phase 2).
_Avoid_: approver, reviewer.

**Patch**:
A canonical War Thunder game version (its own entity, with release date) — the community's primary temporal axis. Every Record references exactly one Patch: the version it was achieved on.
_Avoid_: version, update; free-text patch strings.

### Catalog & rules

**Branch**:
ground / air / naval — a vehicle's category, which determines the Modes it's eligible for (and thus each Mode's completion denominator). A stable, closed set.
_Avoid_: type, category.

**Class**:
A vehicle's class/type (light, medium, heavy, spg, spaa, fighter, attacker, bomber, heli, other) — drives the qualifying threshold.
_Avoid_: type.

**Acquisition** (event / premium / squadron):
How a vehicle is obtained — independent, overlapping flags (an event vehicle may also be premium). Every applicable flag is shown; a tech-tree vehicle carries none.
_Avoid_: a single exclusive acquisition "type".

**Difficult vehicle**:
A vehicle flagged `isDifficult` that uses the Mode's single difficult threshold instead of its (Mode, Class) minimum.

**Qualifying threshold** (min kills):
The minimum kills for a Record to count: the (Mode, Class) minimum, replaced by the Mode's difficult threshold for a Difficult vehicle. Separate from the Supersede rule.

**Battle Rating** (BR):
The matchmaking rating — a one-decimal value, per (vehicle, Mode). The run's BR is also frozen on each Record.

**Open bounty** (unclaimed):
An eligible vehicle with no Current record in a Mode.
_Avoid_: empty, missing.

### Search

**Quick search**:
The single global, cross-Mode search — matches Players and vehicles by name and jumps to a page. Reached from the site header.
_Avoid_: header search (a location, not the concept).

**Browse**:
The Mode-scoped filtered view of that Mode's catalog (nation, class, BR, rank, acquisition), each vehicle with its Current record or Open bounty. The full-filter search surface.
_Avoid_: search page, catalog page.

**Lookup**:
A typeahead that resolves a vehicle *name* to one vehicle and jumps straight to it; free text falls through to Browse. Lives in the Mode hero.
_Avoid_: search box (a Lookup navigates, it doesn't list).

**Search term**:
A matchable variant of a vehicle's name — its normalized form plus deterministic numeral variants (Tiger II ⇄ tiger 2) and, later, curated nicknames. A vehicle has many Search terms; matching any of them finds the vehicle. Display always uses the real name (tree-marker glyphs kept).
_Avoid_: alias (reserved for Player names).

### Surfaces

**Live feed**:
The Mode-scoped, kill-feed-style log of the newest verified Records — new records append at the bottom, the oldest fades out at the top; it moves only when a record actually lands.
_Avoid_: ticker, carousel, "latest feed" (implies rotation).

### Aggregates

**Completion %**:
Per Mode, the fraction of eligible vehicles (by Branch) that have a Current record.

**Contest count**:
Per (vehicle, Mode), how many verified Records that title has ever had — self-improvements included. Ranks the "most contested titles".
_Avoid_: times changed hands (implies holder-change only), hotness.

**Leaderboard**:
Players ranked by Current verified record count — per Mode, plus an all-Modes view. Derived from Records, never stored as counters.
