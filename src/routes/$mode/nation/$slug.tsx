import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { RecordName } from '#/components/record-name'
import { db } from '#/db'
import { getNationSheet } from '#/db/queries'

const loadNationSheet = createServerFn({ method: 'GET' })
  .validator((data: { mode: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const sheet = await getNationSheet(db, data.mode, data.slug)
    if (!sheet) throw notFound()
    return sheet
  })

export const Route = createFileRoute('/$mode/nation/$slug')({
  loader: ({ params, context }) =>
    context.mode.isLive
      ? loadNationSheet({ data: { mode: params.mode, slug: params.slug } })
      : null,
  component: NationSheet,
})

function NationSheet() {
  const { mode } = Route.useParams()
  const data = Route.useLoaderData()
  if (!data) return null
  const { nation, rows } = data

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">
        {nation.name} — {mode.toUpperCase()}
      </h1>
      <table className="mt-4 w-full max-w-3xl text-left">
        <thead className="text-sm text-fg-faint">
          <tr>
            <th className="py-1 pr-4">Vehicle</th>
            <th className="py-1 pr-4">BR</th>
            <th className="py-1 pr-4">Kills</th>
            <th className="py-1">Holder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.vehicleSlug} className="border-t border-white/5">
              <td className="py-1 pr-4">
                <Link
                  to="/$mode/vehicle/$slug"
                  params={{ mode, slug: r.vehicleSlug }}
                >
                  {r.vehicleName}
                </Link>
                {r.isDifficult && <span className="ml-1 text-fg-faint">◆</span>}
              </td>
              <td className="py-1 pr-4 text-fg-muted">{r.br ?? '—'}</td>
              <td className="py-1 pr-4">{r.kills ?? '—'}</td>
              <td className="py-1">
                {r.playerSlug && r.displayName ? (
                  <RecordName
                    displayName={r.displayName}
                    playerSlug={r.playerSlug}
                    ignSnapshot={r.ignSnapshot}
                    displayNameSnapshot={r.displayNameSnapshot}
                  />
                ) : (
                  <span className="text-fg-faint">Open bounty</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
