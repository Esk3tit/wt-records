import postgres from 'postgres'
import { requireEnv } from './env'

/** One suite at a time per database. Worktrees sharing a local Supabase stack
    otherwise provision over each other's users mid-run, and a password write
    drops every session the other run is holding. Uncontended — and therefore
    free — once each checkout has a stack of its own. */

const LOCK_NAME = 'wt-records-e2e'
const POLL_MS = 2_000
const HEARTBEAT_MS = 15_000
const TIMEOUT_MS = 15 * 60_000

type Sql = ReturnType<typeof postgres>

export async function acquireStackLock(
  label: string,
): Promise<() => Promise<void>> {
  const sql = postgres(requireEnv('DATABASE_URL'), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    connection: { application_name: `${LOCK_NAME}:${label}` },
  })
  const startedAt = Date.now()
  // Beat on the first failed attempt, so a wait is never silent.
  let lastBeat = -HEARTBEAT_MS

  try {
    for (;;) {
      const [row] = await sql<{ locked: boolean }[]>`
        select pg_try_advisory_lock(hashtext(${LOCK_NAME})) as locked`
      // Dropping the connection releases the lock, so a killed run can't wedge
      // the machine the way an abandoned lock file would.
      if (row.locked) return async () => void (await sql.end())

      const waited = Date.now() - startedAt
      if (waited >= TIMEOUT_MS) {
        throw new Error(
          `gave up after ${humanize(waited)} waiting for the E2E stack lock ` +
            `(${await describeHolder(sql)})`,
        )
      }
      if (waited - lastBeat >= HEARTBEAT_MS) {
        lastBeat = waited
        console.log(
          `⏳ waiting for the shared E2E stack — ${humanize(waited)} ` +
            `(${await describeHolder(sql)})`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }
  } catch (cause) {
    await sql.end()
    throw cause
  }
}

/** Which checkout is running. Waiters share the application_name prefix, so the
    granted advisory lock is what separates the holder from the queue. */
async function describeHolder(sql: Sql): Promise<string> {
  const holder = (
    await sql<{ who: string; since: string }[]>`
      select a.application_name as who,
             to_char(a.backend_start, 'HH24:MI') as since
      from pg_locks l
      join pg_stat_activity a on a.pid = l.pid
      where l.locktype = 'advisory'
        and l.granted
        and a.application_name like ${`${LOCK_NAME}:%`}
        and a.pid <> pg_backend_pid()
      limit 1`
  ).at(0)
  if (!holder) return 'holder unknown'
  return `held by ${holder.who.slice(LOCK_NAME.length + 1)} since ${holder.since}`
}

function humanize(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}
