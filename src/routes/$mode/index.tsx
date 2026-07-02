import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { LatestRecord } from '#/components/latest-record'
import { LeaderboardList } from '#/components/leaderboard-list'
import { ModeStats } from '#/components/mode-stats'
import { db } from '#/db'
import { getModeHome } from '#/db/queries'

const loadModeHome = createServerFn({ method: 'GET' })
  .validator((mode: string) => mode)
  .handler(({ data }) => getModeHome(db, data))

export const Route = createFileRoute('/$mode/')({
  loader: ({ params, context }) =>
    context.mode.isLive
      ? loadModeHome({ data: params.mode })
      : { stats: null, leaders: [], latest: null },
  component: ModeHome,
})

function ModeHome() {
  const { mode } = Route.useParams()
  const { stats, leaders, latest } = Route.useLoaderData()

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">{mode.toUpperCase()}</h1>

      {stats && (
        <div className="mt-4">
          <ModeStats stats={stats} />
        </div>
      )}

      <nav className="mt-4 flex gap-4 text-sm text-accent">
        <Link to="/$mode/leaderboard" params={{ mode }}>
          Leaderboard
        </Link>
        <Link to="/$mode/nations" params={{ mode }}>
          Nations
        </Link>
        <Link to="/rules/$mode" params={{ mode }}>
          Rules
        </Link>
      </nav>

      <div className="mt-6">
        <h2 className="text-fg-muted">Top holders</h2>
        <div className="mt-2">
          <LeaderboardList rows={leaders} />
        </div>
      </div>

      {latest && (
        <div className="mt-6">
          <h2 className="text-fg-muted">Latest record</h2>
          <div className="mt-2">
            <LatestRecord mode={mode} record={latest} />
          </div>
        </div>
      )}
    </section>
  )
}
