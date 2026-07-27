import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { NationStandings } from '#/components/nation-standings'
import { db } from '#/db'
import { listNationStandings } from '#/db/queries'

const loadStandings = createServerFn({ method: 'GET' })
  .validator((mode: string) => mode)
  .handler(async ({ data }) => {
    const standings = await listNationStandings(db, data)
    if (!standings) throw notFound()
    return standings
  })

export const Route = createFileRoute('/$mode/nations')({
  loader: ({ params, context }) =>
    context.mode.isLive
      ? loadStandings({ data: params.mode })
      : { contested: false, nations: [] },
  component: Nations,
})

function Nations() {
  const { mode } = Route.useParams()
  const { mode: modeCtx } = Route.useRouteContext()
  const { contested, nations } = Route.useLoaderData()

  return (
    <section className="py-6">
      <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-fg-muted uppercase">
        {mode.toUpperCase()} · {modeCtx.name}
      </p>
      <h1 className="mt-1.5 text-2xl font-semibold">Nations</h1>
      <div className="mt-5">
        <NationStandings mode={mode} contested={contested} nations={nations} />
      </div>
    </section>
  )
}
