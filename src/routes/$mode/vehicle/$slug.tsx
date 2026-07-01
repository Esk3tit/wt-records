import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { RecordName } from '#/components/record-name'
import { db } from '#/db'
import { getVehicle } from '#/db/queries'

const loadVehicle = createServerFn({ method: 'GET' })
  .validator((data: { mode: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const vehicle = await getVehicle(db, data.mode, data.slug)
    if (!vehicle) throw notFound()
    return vehicle
  })

export const Route = createFileRoute('/$mode/vehicle/$slug')({
  loader: ({ params, context }) =>
    context.mode.isLive
      ? loadVehicle({ data: { mode: params.mode, slug: params.slug } })
      : null,
  component: VehicleDetail,
})

function VehicleDetail() {
  const { mode } = Route.useParams()
  const data = Route.useLoaderData()
  if (!data) return null
  const { vehicle, br, current, proofs } = data

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">{vehicle.name}</h1>
      <p className="mt-1 text-fg-muted">
        <Link to="/$mode/nation/$slug" params={{ mode, slug: vehicle.nationSlug }}>
          {vehicle.nationName}
        </Link>{' '}
        · {vehicle.class}
        {vehicle.rank ? ` · rank ${vehicle.rank}` : ''}
        {br != null ? ` · BR ${br}` : ''}
      </p>

      {current ? (
        <div className="mt-6">
          <h2 className="text-fg-muted">Current record</h2>
          <p className="mt-2 text-xl">
            {current.kills} kills —{' '}
            <RecordName
              displayName={current.displayName}
              playerSlug={current.playerSlug}
              ignSnapshot={current.ignSnapshot}
              displayNameSnapshot={current.displayNameSnapshot}
            />
          </p>
          <p className="mt-1 text-sm text-fg-faint">
            {current.runBr != null ? `Run BR ${current.runBr}` : null}
            {current.patch ? ` · patch ${current.patch}` : null}
          </p>
          {proofs.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {proofs.map((p) => (
                <li key={p.id}>
                  {p.originalUrl ? (
                    <a href={p.originalUrl} className="text-accent">
                      {p.kind}
                    </a>
                  ) : (
                    <span className="text-fg-muted">{p.kind}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-6 text-fg-faint">Open bounty — no current record.</p>
      )}
    </section>
  )
}
