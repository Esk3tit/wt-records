import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '#/db/schema'

export interface CliDb {
  db: ReturnType<typeof drizzle<typeof schema>>
  close: () => Promise<void>
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Guard input for the destructive CLI runners: anything not provably local
    (unparseable included) must be an explicit env-var opt-in. */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/** One-shot DB handle for CLI scripts (seed, catalog-sync) — connection
    options encoded once: pooler-safe prepare:false, fail-fast connects. */
export function openCliDb(url: string): CliDb {
  const client = postgres(url, { prepare: false, connect_timeout: 10 })
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  }
}
