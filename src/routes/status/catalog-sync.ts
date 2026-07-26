import { createFileRoute } from '@tanstack/react-router'
import { readCatalogSyncStatus } from '#/catalog/sync-status'
import { db } from '#/db'

// Drizzle wraps the driver error, and the wrapper says only which SQL failed —
// the cause ("relation … does not exist") is the half worth reporting.
function causeOf(error: unknown): string {
  if (error instanceof Error && error.cause instanceof Error)
    return error.cause.message
  return error instanceof Error ? error.message : String(error)
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
