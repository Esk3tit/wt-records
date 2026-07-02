import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { RemovedTag } from '#/components/removed-tag'
import { db } from '#/db'
import { getPlayer } from '#/db/queries'

const loadPlayer = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data }) => {
    const player = await getPlayer(db, data)
    if (!player) throw notFound()
    return player
  })

export const Route = createFileRoute('/player/$slug')({
  loader: ({ params }) => loadPlayer({ data: params.slug }),
  component: PlayerProfile,
})

function PlayerProfile() {
  const { player, aliases, records } = Route.useLoaderData()
  const formerNames = aliases.filter((name) => name !== player.displayName)

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">{player.displayName}</h1>
      {formerNames.length > 0 && (
        <p className="mt-1 text-sm text-fg-faint">
          previously known as {formerNames.join(', ')}
        </p>
      )}

      <h2 className="mt-6 text-fg-muted">Current records</h2>
      {records.length === 0 ? (
        <p className="mt-2 text-fg-faint">No current records.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {records.map((r) => (
            <li key={`${r.mode}-${r.vehicleSlug}`} className="flex gap-3">
              <span className="w-12 text-fg-faint">{r.mode.toUpperCase()}</span>
              <Link
                to="/$mode/vehicle/$slug"
                params={{ mode: r.mode, slug: r.vehicleSlug }}
              >
                {r.vehicleName}
              </Link>
              {r.isRemoved && <RemovedTag />}
              <span className="ml-auto text-fg-muted">{r.kills}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
