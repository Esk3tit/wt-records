import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ComingSoon } from '#/components/coming-soon'
import { db } from '#/db'
import { getRules } from '#/db/queries'

const loadRules = createServerFn({ method: 'GET' })
  .validator((mode: string) => mode)
  .handler(async ({ data }) => {
    const rules = await getRules(db, data)
    if (!rules) throw notFound()
    return rules
  })

export const Route = createFileRoute('/rules/$mode')({
  loader: ({ params }) => loadRules({ data: params.mode }),
  component: Rules,
})

function Rules() {
  const { mode, thresholds } = Route.useLoaderData()
  if (!mode.isLive) return <ComingSoon modeName={mode.name} />

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">{mode.name} — rules</h1>

      {mode.rulesMd ? (
        <pre className="mt-4 whitespace-pre-wrap text-fg-muted">{mode.rulesMd}</pre>
      ) : (
        <p className="mt-4 text-fg-muted">
          A record counts once it clears the qualifying threshold for its class. A
          title is taken only by strictly exceeding the current record’s kills.
        </p>
      )}

      <h2 className="mt-6 text-fg-muted">Qualifying thresholds</h2>
      <table className="mt-2 text-left">
        <thead className="text-sm text-fg-faint">
          <tr>
            <th className="py-1 pr-6">Class</th>
            <th className="py-1">Min kills</th>
          </tr>
        </thead>
        <tbody>
          {thresholds.map((t) => (
            <tr key={t.class} className="border-t border-white/5">
              <td className="py-1 pr-6">{t.class}</td>
              <td className="py-1">{t.minKills}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mode.difficultMinKills != null && (
        <p className="mt-2 text-sm text-fg-faint">
          Difficult vehicles use a flat threshold of {mode.difficultMinKills} kills.
        </p>
      )}
    </section>
  )
}
