import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { LatestRecord } from '#/components/latest-record'
import { LeaderboardList } from '#/components/leaderboard-list'
import { ModeStats } from '#/components/mode-stats'
import { RecordMonument } from '#/components/record-monument'
import { TopRecords } from '#/components/top-records'
import { db } from '#/db'
import { getModeHome } from '#/db/queries'

const loadModeHome = createServerFn({ method: 'GET' })
  .validator((mode: string) => mode)
  .handler(({ data }) => getModeHome(db, data))

export const Route = createFileRoute('/$mode/')({
  loader: ({ params, context }) =>
    context.mode.isLive
      ? loadModeHome({ data: params.mode })
      : { stats: null, leaders: [], topRecords: [], latest: null },
  component: ModeHome,
})

function ModeHome() {
  const { mode } = Route.useParams()
  const { mode: modeCtx } = Route.useRouteContext()
  const { stats, leaders, topRecords, latest } = Route.useLoaderData()
  // Indexed access is typed always-present here; make emptiness explicit.
  const monument = topRecords.length > 0 ? topRecords[0] : null
  const chasers = topRecords.slice(1)

  return (
    <>
      <section className="glass-thick relative mt-6 overflow-hidden px-6 py-8 sm:px-9 sm:py-9">
        <div className="monument-glow" aria-hidden="true" />
        <div className="relative grid items-end gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="kicker">Live registry</p>
            <h1 className="mt-3 mb-2.5 text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.05] font-bold tracking-[-0.02em] [text-wrap:balance]">
              {modeCtx.name}
            </h1>
            <p className="max-w-[32.5rem] leading-[1.55] text-fg-muted">
              Single-life kill records for every vehicle in{' '}
              <b className="font-semibold text-fg">War Thunder</b>{' '}
              {modeCtx.name.replace(/^Ground |^Air |^Naval /, '')}. One title
              per vehicle — only strictly more kills takes it.
            </p>
            {stats && <ModeStats stats={stats} />}
          </div>
          <RecordMonument
            mode={mode}
            record={monument}
            eligibleVehicles={stats?.eligibleVehicles ?? 0}
          />
        </div>
      </section>

      <nav
        aria-label={`${mode.toUpperCase()} sections`}
        className="mt-5 flex flex-wrap gap-2 text-sm font-medium [&_a]:no-underline"
      >
        {(
          [
            ['/$mode/leaderboard', 'Leaderboard'],
            ['/$mode/nations', 'Nations'],
            ['/rules/$mode', 'Rules'],
          ] as const
        ).map(([to, label]) => (
          <Link
            key={to}
            to={to}
            params={{ mode }}
            className="rounded-full border border-hairline bg-tint px-4 py-1.5 text-fg-muted transition-colors duration-200 hover:text-fg"
          >
            {label}
          </Link>
        ))}
      </nav>

      {monument && (
        <div className="mt-10 grid items-start gap-x-5 gap-y-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <h2 className="section-label mx-1 mb-4">Chasing the crown</h2>
            {chasers.length > 0 ? (
              <TopRecords mode={mode} records={chasers} />
            ) : (
              <p className="glass-mid px-5 py-4 text-fg-muted">
                One title on the books — every other vehicle is open.
              </p>
            )}
            {latest && (
              <p className="glass-thin mt-3.5 rounded-[22px] px-5 py-3.5 text-sm text-fg-muted">
                <span className="font-semibold text-fg">Latest — </span>
                <LatestRecord mode={mode} record={latest} />
              </p>
            )}
          </div>
          <div>
            <h2 className="section-label mx-1 mb-4">Standings</h2>
            <div className="glass-mid overflow-hidden">
              <LeaderboardList rows={leaders} medals />
            </div>
            <p className="mt-3 text-right text-sm">
              <Link
                to="/$mode/leaderboard"
                params={{ mode }}
                className="text-accent-text"
              >
                Full leaderboard →
              </Link>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
