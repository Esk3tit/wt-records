import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { LatestRecord } from '#/components/latest-record'
import { LeaderboardList } from '#/components/leaderboard-list'
import { ModeStats } from '#/components/mode-stats'
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
  const hasRecords = (stats?.records ?? 0) > 0

  return (
    <>
      <section className="glass-thick mt-6 px-6 py-8 sm:px-9 sm:py-9">
        <p className="kicker">Live registry</p>
        <h1 className="mt-3 mb-2.5 text-[clamp(2.375rem,6vw,4.25rem)] leading-none font-bold tracking-[-0.02em] [text-wrap:balance]">
          {modeCtx.name}
        </h1>
        <p className="max-w-[32.5rem] leading-[1.55] text-fg-muted">
          Single-life kill records for every vehicle in{' '}
          <b className="font-semibold text-fg">War Thunder</b>{' '}
          {modeCtx.name.replace(/^Ground |^Air |^Naval /, '')}. One title per
          vehicle — only strictly more kills takes it.
        </p>
        {stats && <ModeStats stats={stats} />}
        {latest && (
          <p className="mt-5 text-sm text-fg-muted">
            <span className="font-semibold text-fg">Latest — </span>
            <LatestRecord mode={mode} record={latest} />
          </p>
        )}
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

      {hasRecords ? (
        <>
          <h2 className="section-label mx-1 mt-10 mb-4">Top records</h2>
          <TopRecords mode={mode} records={topRecords} />

          <h2 className="section-label mx-1 mt-10 mb-4">Player standings</h2>
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
        </>
      ) : (
        <section className="glass-mid mt-10 px-6 py-8 text-center">
          <h2 className="text-xl font-semibold">Every title is open.</h2>
          <p className="mx-auto mt-2 max-w-[32.5rem] text-fg-muted">
            No records are on the books for {modeCtx.name} yet — every eligible
            vehicle is an open bounty waiting for its first verified holder.
          </p>
        </section>
      )}
    </>
  )
}
