import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { VehicleTags } from '#/components/vehicle-tags'
import { db } from '#/db'
import { getPlayer, playerMergeRedirect } from '#/db/queries'
import { toPlayerCardModel } from '#/og/props/player'
import { playerUnfurl } from '#/og/copy'
import { playerCardUrl } from '#/og/urls'
import { cardMeta } from '#/og/meta'

const loadPlayer = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data }) => {
    const player = await getPlayer(db, data)
    if (player) return { profile: player, redirectTo: null }
    const redirectTo = await playerMergeRedirect(db, data)
    if (redirectTo) return { profile: null, redirectTo }
    throw notFound()
  })

export const Route = createFileRoute('/player/$slug')({
  loader: async ({ params }) => {
    const result = await loadPlayer({ data: params.slug })
    if (result.redirectTo) {
      // Merged player: permanent redirect straight to the survivor.
      throw redirect({
        to: '/player/$slug',
        params: { slug: result.redirectTo },
        statusCode: 301,
      })
    }
    if (!result.profile) throw notFound()
    return result.profile
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {}
    const model = toPlayerCardModel(loaderData)
    const { title, description } = playerUnfurl(model)
    return {
      meta: cardMeta({
        title,
        description,
        image: playerCardUrl(params.slug, { version: model.version }),
      }),
    }
  },
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
              <span className="w-12 shrink-0 text-fg-faint">
                {r.mode.toUpperCase()}
              </span>
              <span className="min-w-0">
                <Link
                  to="/$mode/vehicle/$slug"
                  params={{ mode: r.mode, slug: r.vehicleSlug }}
                >
                  {r.vehicleName}
                </Link>
                <VehicleTags tags={r} />
              </span>
              <span className="ml-auto text-fg-muted">{r.kills}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
