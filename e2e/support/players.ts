import postgres from 'postgres'
import type { Sql } from 'postgres'
import { requireEnv } from './env'
import { parseLinkValue } from '#/links/parse'

/** A Player a spec brings with it, rather than one the seed happened to leave:
    isolated on its own slug so parallel specs never touch each other's row. */
export interface PlayerSeed {
  slug: string
  displayName: string
  aliases?: string[]
  /** Claims the page for that user, which is what `isClaimed` reads. */
  ownerEmail?: string
  /** Users the *body* will file or approve a claim for, rather than the seed.
      Named so they queue behind the same lock `ownerEmail` takes: a claim
      arriving through the flow lands on the same one-claim-per-user index, and
      a fixture that does not declare it races every fixture that does. */
  claimsAs?: ReadonlyArray<string>
  avatarKey?: string
  /** Profile links, as the write path would have stored them. */
  links?: Array<{ platform: string; handle: string }>
}

/* One connection, not the default pool of ten: a fixture runs its statements in
   order, and a suite this parallel can otherwise take every slot the local
   Postgres has — which surfaces as auth 500s, not as a failing fixture. */
function connect(): Sql {
  return postgres(requireEnv('DATABASE_URL'), {
    prepare: false,
    connect_timeout: 10,
    max: 1,
  })
}

async function userId(sql: Sql, email: string): Promise<string> {
  const found = (
    await sql<{ id: string }[]>`
      select id from auth.users where email = ${email}
    `
  ).at(0)?.id
  if (!found) throw new Error(`${email} must be provisioned first`)
  return found
}

/** Delete-first, so a slug left behind by a prior failure isn't taken. */
async function seedPlayer(
  sql: Sql,
  {
    slug,
    displayName,
    aliases = [],
    ownerEmail,
    avatarKey,
    links = [],
  }: PlayerSeed,
): Promise<number> {
  await dropPlayer(sql, slug)
  const owner = ownerEmail ? await userId(sql, ownerEmail) : null
  const [player] = await sql<{ id: number }[]>`
    insert into players (slug, display_name, user_id, avatar_key)
    values (${slug}, ${displayName}, ${owner}, ${avatarKey ?? null})
    returning id
  `
  for (const alias of aliases) {
    await sql`
      insert into player_aliases (player_id, name) values (${player.id}, ${alias})
    `
  }
  for (const link of links) {
    /* Through the production parser rather than a hand-rolled fold: Discord
       does not fold at all and a personal site's path is case-sensitive, so
       lower-casing the raw value would both corrupt the path and let a fixture
       store something the write path would have refused. A slug is per-spec,
       but a handle is global — the caller derives one from its own slug, or two
       specs meet on plink_handle_uq. */
    const stored = parseLinkValue(link.platform, link.handle)
    await sql`
      insert into player_links (player_id, platform, handle, normalized_handle)
      values (${player.id}, ${stored.platform}, ${stored.handle}, ${stored.normalized})
    `
  }
  return player.id
}

async function dropPlayer(sql: Sql, slug: string): Promise<void> {
  await sql`
    delete from player_aliases
    where player_id in (select id from players where slug = ${slug})
  `
  await sql`
    delete from player_amendments
    where player_id in (select id from players where slug = ${slug})
  `
  await sql`
    delete from player_links
    where player_id in (select id from players where slug = ${slug})
  `
  // A request left on the row is a foreign key: the delete below fails
  // silently without this, and the next run finds the slug already taken.
  await sql`
    delete from player_claims
    where player_id in (select id from players where slug = ${slug})
  `
  await sql`delete from players where slug = ${slug}`
}

/** Runs a case against a freshly seeded Player and takes the row away after,
    whether the assertions passed or not. The body is handed the connection so
    a case can read or write the row it is asserting on. */
export async function withPlayer(
  seed: PlayerSeed,
  body: (player: { sql: Sql; id: number }) => Promise<void>,
): Promise<void> {
  const sql = connect()
  try {
    /* Two parallel cases claiming as the same user collide on ply_user_uq;
       this queues them. Session-scoped — the disconnect below frees it. Taken
       in a fixed order, so a case naming two users cannot deadlock against one
       naming them the other way round. */
    const claimants = [
      ...new Set([seed.ownerEmail, ...(seed.claimsAs ?? [])]),
    ].filter((email): email is string => email != null)
    for (const email of claimants.sort()) {
      await sql`select pg_advisory_lock(hashtext(${`e2e-owner:${email}`}))`
    }
    /* Delete-first covers the slug; the claim is the other thing a killed run
       leaves behind, and `ply_user_uq` then makes one stray row fatal to every
       later fixture claiming as that user — the suite reports a constraint
       violation rather than whatever actually broke. Freed for the same reason
       the slug is, and safely: the locks above are held by every case that
       claims, so the only claim this can take is a dead one. */
    for (const email of claimants) {
      await sql`
        update players set user_id = null
        where user_id = (select id from auth.users where email = ${email})
      `
    }
    const id = await seedPlayer(sql, seed)
    await body({ sql, id })
  } finally {
    /* The connection goes back whatever happened: a leaked one holds a slot,
       and a hundred is all the local Postgres has — spent, they surface as
       auth 500s rather than as a failing fixture. A drop that fails is left
       to say nothing, both because it would mask what the case was actually
       failing on, and because seeding deletes the slug first, so a row left
       behind is taken by the next run rather than in the way of it. */
    await dropPlayer(sql, seed.slug).catch(() => undefined)
    await sql.end()
  }
}
