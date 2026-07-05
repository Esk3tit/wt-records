import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db'

/* Deploy healthchecks probe this instead of a full page render: the app can
   be alive while the database provider browns out, and deploys must not be
   hostage to that. 200 = app up; the body reports the database's state. */
export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: async () => {
        // Raw client so a timed-out ping is CANCELLED — an abandoned query
        // would hold a pooled connection through the very brownout that
        // makes probes frequent.
        const ping = db.$client`select 1`
        const dbState = await Promise.race([
          ping.then(() => 'ok' as const).catch(() => 'unavailable' as const),
          new Promise<'unavailable'>((resolve) =>
            setTimeout(() => {
              ping.cancel()
              resolve('unavailable')
            }, 2000),
          ),
        ])
        return Response.json({ status: 'ok', db: dbState })
      },
    },
  },
})
