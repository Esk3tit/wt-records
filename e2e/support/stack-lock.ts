import postgres from 'postgres'
import { requireEnv } from './env'

/** One suite at a time per database — worktrees sharing a local Supabase stack
    otherwise provision over each other's users mid-run. */

const LOCK_NAME = 'wt-records-e2e'
// The two-int form, not a hashed name: pg_locks records these verbatim, so the
// grant can be matched exactly. Arbitrary, positive (pg_locks stores oids).
const LOCK_KEY = { classid: 0x5754, objid: 0x5245 } as const
const POLL_MS = 2_000
const HEARTBEAT_MS = 15_000
const TIMEOUT_MS = 15 * 60_000

type Sql = ReturnType<typeof postgres>

export async function acquireStackLock(
  label: string,
): Promise<() => Promise<void>> {
  let holding = false
  let releasing = false
  const sql = postgres(requireEnv('DATABASE_URL'), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    connection: { application_name: `${LOCK_NAME}:${label}` },
    // The lock lives on this connection, and the driver reaps idle connections
    // after ~30 minutes by default — which would release it mid-run.
    max_lifetime: null,
    onclose: () => {
      if (!holding) return
      holding = false
      // Teardown ends the connection under us, which fails these queries for a
      // reason that says nothing about the lock. Never fail a finished run.
      void reclaim(sql).then(
        (regained) => {
          if (releasing) return
          if (regained) {
            holding = true
            return
          }
          abandon('another suite may now be running against this database')
        },
        (cause) => {
          if (releasing) return
          abandon(`it could not be checked: ${String(cause)}`)
        },
      )
    },
  })
  const startedAt = Date.now()
  // Beat on the first failed attempt, so a wait is never silent.
  let lastBeat = -HEARTBEAT_MS

  try {
    for (;;) {
      const [row] = await sql<{ locked: boolean }[]>`
        select pg_try_advisory_lock(${LOCK_KEY.classid}::int, ${LOCK_KEY.objid}::int) as locked`
      // Dropping the connection releases the lock, so a killed run can't wedge
      // the machine the way an abandoned lock file would.
      if (row.locked) {
        await assertSessionScoped(sql)
        holding = true
        return async () => {
          releasing = true
          holding = false
          await sql.end()
        }
      }

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

/** Whether THIS backend holds THIS key — not merely some advisory lock, which
    a pooled backend could be holding on someone else's behalf. */
async function heldHere(sql: Sql): Promise<boolean> {
  const rows = await sql<{ held: boolean }[]>`
    select exists (
      select 1 from pg_locks
      where locktype = 'advisory'
        and granted
        and pid = pg_backend_pid()
        and classid = ${LOCK_KEY.classid}::oid
        and objid = ${LOCK_KEY.objid}::oid
        and objsubid = 2
    ) as held`
  return rows.at(0)?.held === true
}

function abandon(reason: string): never {
  console.error(
    `✖ lost the shared E2E stack lock — ${reason}, so nothing this run ` +
      `reports can be trusted.`,
  )
  process.exit(1)
}

/** A transaction pooler gives each statement a different backend, so it reports
    the lock taken while holding nothing. Confirm the grant is on this session. */
async function assertSessionScoped(sql: Sql): Promise<void> {
  if (await heldHere(sql)) return
  throw new Error(
    'took the E2E stack lock but does not hold it — DATABASE_URL looks like a ' +
      'transaction pooler, which cannot keep a session-level lock. Point it at ' +
      'a direct or session-pooler connection.',
  )
}

/** A dropped connection releases the lock server-side. Only one session can hold
    it, and a waiter that takes it keeps it for its whole run — so regaining it
    proves nobody else did, and failing proves somebody has. */
async function reclaim(sql: Sql): Promise<boolean> {
  const [row] = await sql<{ locked: boolean }[]>`
    select pg_try_advisory_lock(${LOCK_KEY.classid}::int, ${LOCK_KEY.objid}::int) as locked`
  const regained = row.locked
  // Taking it back is only worth anything if this session is the one holding it.
  return regained && (await heldHere(sql))
}

/** Which checkout is running. Waiters share the application_name prefix, so the
    granted advisory lock is what separates the holder from the queue. */
async function describeHolder(sql: Sql): Promise<string> {
  const holder = (
    await sql<{ who: string; heldMs: number }[]>`
      select a.application_name as who,
             (extract(epoch from (now() - a.backend_start)) * 1000)::bigint as "heldMs"
      from pg_locks l
      join pg_stat_activity a on a.pid = l.pid
      where l.locktype = 'advisory'
        and l.granted
        and a.application_name like ${`${LOCK_NAME}:%`}
        and a.pid <> pg_backend_pid()
      limit 1`
  ).at(0)
  if (!holder) return 'holder unknown'
  // A duration, not a clock time: the container runs UTC and the reader doesn't.
  return `held by ${holder.who.slice(LOCK_NAME.length + 1)} for ${humanize(Number(holder.heldMs))}`
}

function humanize(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}
