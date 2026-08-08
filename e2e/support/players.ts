import postgres from 'postgres'
import type { Sql } from 'postgres'
import { requireEnv } from './env'

/** A Player a spec brings with it, rather than one the seed happened to leave:
    isolated on its own slug so parallel specs never touch each other's row. */
export interface PlayerSeed {
  slug: string
  displayName: string
  aliases?: string[]
  /** Claims the page for that user, which is what `isClaimed` reads. */
  ownerEmail?: string
  avatarKey?: string
}

/* One connection, not the default pool of ten: a fixture runs its statements in
   order, and a suite this parallel can otherwise take every slot the local
   Postgres has — which surfaces as auth 500s, not as a failing fixture. */
export function connect(): Sql {
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
export async function seedPlayer(
  sql: Sql,
  { slug, displayName, aliases = [], ownerEmail, avatarKey }: PlayerSeed,
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
  return player.id
}

export async function dropPlayer(sql: Sql, slug: string): Promise<void> {
  await sql`
    delete from player_aliases
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
    const id = await seedPlayer(sql, seed)
    await body({ sql, id })
  } finally {
    await dropPlayer(sql, seed.slug)
    await sql.end()
  }
}
