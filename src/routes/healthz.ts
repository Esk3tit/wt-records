import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'
import { db } from '#/db'

/* Deploy healthchecks probe this instead of a full page render: the app can
   be alive while the database provider browns out, and deploys must not be
   hostage to that. 200 = app up; the body reports the database's state. */
export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: async () => {
        const dbState = await Promise.race([
          db
            .execute(sql`select 1`)
            .then(() => 'ok' as const)
            .catch(() => 'unavailable' as const),
          new Promise<'unavailable'>((resolve) =>
            setTimeout(() => resolve('unavailable'), 2000),
          ),
        ])
        return Response.json({ status: 'ok', db: dbState })
      },
    },
  },
})
