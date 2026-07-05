import { createFileRoute } from '@tanstack/react-router'
import { healthPing } from '#/db/health'

/* Deploy healthchecks probe this instead of a full page render: the app can
   be alive while the database provider browns out, and deploys must not be
   hostage to that. 200 = app up; the body reports the database's state. The
   ping runs on its own single-connection client (see #/db/health), so a
   stalled probe can never crowd real page queries out of the app pool. */
export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: async () => {
        const ping = healthPing()
        const dbState = await Promise.race([
          ping.then(() => 'ok' as const).catch(() => 'unavailable' as const),
          new Promise<'unavailable'>((resolve) =>
            setTimeout(() => {
              // Best effort — cancellation itself can stall in a brownout,
              // but the isolated client bounds the damage to one connection.
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
