import { createFileRoute } from '@tanstack/react-router'
import { DETAIL_MAX, readCatalogSyncStatus } from '#/catalog/sync-status'
import { db } from '#/db'

// Drizzle wraps the driver error, and the wrapper says only which SQL failed —
// the cause ("relation … does not exist") is the half worth reporting. Capped
// like a recorded detail: this answer is public, so it gets no unbounded field.
function causeOf(error: unknown): string {
  if (!(error instanceof Error)) return String(error).slice(0, DETAIL_MAX)
  const cause = error.cause instanceof Error ? error.cause : error
  return cause.message.slice(0, DETAIL_MAX)
}

// Catalog-cron freshness for the watchdog. Unauthenticated so the probe holds no
// secret; it tells anyone only when the public catalog last synced.
export const Route = createFileRoute('/status/catalog-sync')({
  server: {
    handlers: {
      GET: async () => {
        const headers = { 'cache-control': 'no-store' }
        try {
          const status = await readCatalogSyncStatus(db)
          return Response.json({ db: 'ok', ...status }, { headers })
        } catch (error) {
          // 200 with the state in the body, as /healthz does: the watchdog must
          // alarm on an unreadable signal, not confuse it with an app that's down.
          return Response.json(
            {
              db: 'unavailable',
              reason: causeOf(error),
              lastSuccessAt: null,
              ageSeconds: null,
              lastRun: null,
            },
            { headers },
          )
        }
      },
    },
  },
})
