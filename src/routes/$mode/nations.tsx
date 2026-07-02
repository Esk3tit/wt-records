import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { completionPct } from '#/lib/completion'
import { db } from '#/db'
import { listNations } from '#/db/queries'

const loadNations = createServerFn({ method: 'GET' })
  .validator((mode: string) => mode)
  .handler(async ({ data }) => {
    const nations = await listNations(db, data)
    if (!nations) throw notFound()
    return nations
  })

export const Route = createFileRoute('/$mode/nations')({
  loader: ({ params, context }) =>
    context.mode.isLive ? loadNations({ data: params.mode }) : [],
  component: Nations,
})

function Nations() {
  const { mode } = Route.useParams()
  const nations = Route.useLoaderData()

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">{mode.toUpperCase()} nations</h1>
      <ul className="mt-4 space-y-1">
        {nations.map((n) => {
          const pct = completionPct(n.coveredVehicles, n.eligibleVehicles)
          return (
            <li key={n.slug} className="flex items-baseline gap-3">
              <Link to="/$mode/nation/$slug" params={{ mode, slug: n.slug }}>
                {n.name}
              </Link>
              <span className="ml-auto text-fg-muted">
                {n.coveredVehicles}/{n.eligibleVehicles} · {pct}%
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
