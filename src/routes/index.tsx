import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Brand } from '#/components/brand'
import { LatestRecord } from '#/components/latest-record'
import { LeaderboardList } from '#/components/leaderboard-list'
import { ModeStats } from '#/components/mode-stats'
import { db } from '#/db'
import { getModeHome } from '#/db/queries'

const DEFAULT_MODE = 'grb'

const loadHome = createServerFn({ method: 'GET' }).handler(() =>
  getModeHome(db, DEFAULT_MODE),
)

export const Route = createFileRoute('/')({
  loader: () => loadHome(),
  component: Home,
})

function Home() {
  const { stats, leaders, latest } = Route.useLoaderData()

  return (
    <section className="p-8">
      <h1 className="text-4xl font-bold">
        <Brand />
      </h1>
      <p className="mt-2 text-fg-muted">
        World-record registry for War Thunder — most kills in a single life, per
        vehicle, per mode.
      </p>

      {stats && (
        <div className="mt-6">
          <ModeStats stats={stats} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-8">
        <div>
          <h2 className="text-fg-muted">Top holders (GRB)</h2>
          <div className="mt-2">
            <LeaderboardList rows={leaders} />
          </div>
          <Link
            to="/$mode/leaderboard"
            params={{ mode: DEFAULT_MODE }}
            className="mt-2 inline-block text-sm text-accent"
          >
            Full leaderboard →
          </Link>
        </div>

        {latest && (
          <div>
            <h2 className="text-fg-muted">Latest record</h2>
            <div className="mt-2">
              <LatestRecord mode={DEFAULT_MODE} record={latest} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
