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
    <>
      <section className="glass-thick mt-6 px-6 py-8 sm:px-9 sm:py-9">
        <h1 className="text-4xl">
          <Brand />
        </h1>
        <p className="mt-2 max-w-[32.5rem] leading-[1.55] text-fg-muted">
          World-record registry for War Thunder — most kills in a single life,
          per vehicle, per mode.
        </p>
        {stats && <ModeStats stats={stats} />}
        {latest && (
          <p className="mt-5 text-sm text-fg-muted">
            <span className="font-semibold text-fg">Latest — </span>
            <LatestRecord mode={DEFAULT_MODE} record={latest} />
          </p>
        )}
      </section>

      <h2 className="section-label mx-1 mt-10 mb-4">Top holders · GRB</h2>
      <div className="glass-mid overflow-hidden">
        <LeaderboardList rows={leaders} medals />
      </div>
      <p className="mt-3 text-right text-sm">
        <Link
          to="/$mode/leaderboard"
          params={{ mode: DEFAULT_MODE }}
          className="text-accent-text"
        >
          Full leaderboard →
        </Link>
      </p>
    </>
  )
}
