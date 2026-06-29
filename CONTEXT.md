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

### Catalog & rules

**Branch**:
ground / air / naval — a vehicle's category, which determines the Modes it's eligible for (and thus each Mode's completion denominator). A stable, closed set.
_Avoid_: type, category.

**Class**:
A vehicle's class/type (light, medium, heavy, spg, spaa, fighter, attacker, bomber, heli, other) — drives the qualifying threshold.
_Avoid_: type.

**Difficult vehicle**:
A vehicle flagged `isDifficult` that uses the Mode's single difficult threshold instead of its (Mode, Class) minimum.

**Qualifying threshold** (min kills):
The minimum kills for a Record to count: the (Mode, Class) minimum, replaced by the Mode's difficult threshold for a Difficult vehicle. Separate from the Supersede rule.

**Battle Rating** (BR):
The matchmaking rating — a one-decimal value, per (vehicle, Mode). The run's BR is also frozen on each Record.

**Open bounty** (unclaimed):
An eligible vehicle with no Current record in a Mode.
_Avoid_: empty, missing.

### Aggregates

**Completion %**:
Per Mode, the fraction of eligible vehicles (by Branch) that have a Current record.

**Leaderboard**:
Players ranked by Current verified record count — per Mode, plus an all-Modes view. Derived from Records, never stored as counters.
