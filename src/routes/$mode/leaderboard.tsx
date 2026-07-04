import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { LeaderboardList } from '#/components/leaderboard-list'
import { db } from '#/db'
import { getLeaderboard } from '#/db/queries'

const loadLeaderboard = createServerFn({ method: 'GET' })
  .validator((mode: string) => mode)
  .handler(({ data }) => getLeaderboard(db, data))

export const Route = createFileRoute('/$mode/leaderboard')({
  loader: ({ params, context }) =>
    context.mode.isLive ? loadLeaderboard({ data: params.mode }) : [],
  component: Leaderboard,
})

function Leaderboard() {
  const { mode } = Route.useParams()
  const rows = Route.useLoaderData()

  return (
    <section className="py-6">
      <h1 className="text-2xl font-semibold">
        {mode.toUpperCase()} leaderboard
      </h1>
      <div className="glass-mid mt-4 overflow-hidden">
        <LeaderboardList rows={rows} medals />
      </div>
    </section>
  )
}
