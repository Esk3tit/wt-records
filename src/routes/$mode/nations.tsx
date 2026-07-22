import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { NationCompletion } from '#/components/nation-completion'
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
  const { mode: modeCtx } = Route.useRouteContext()
  const nations = Route.useLoaderData()

  return (
    <section className="py-6">
      <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-fg-muted uppercase">
        {mode.toUpperCase()} · {modeCtx.name}
      </p>
      <h1 className="mt-1.5 text-2xl font-semibold">Nations</h1>
      <div className="mt-5">
        <NationCompletion mode={mode} nations={nations} />
      </div>
    </section>
  )
}
