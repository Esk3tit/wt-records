import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ModeLanding } from '#/components/mode-landing'
import { db } from '#/db'
import { getModeLanding } from '#/db/queries'

const loadLanding = createServerFn({ method: 'GET' })
  .validator((mode: string) => mode)
  .handler(({ data }) => getModeLanding(db, data))

export const Route = createFileRoute('/$mode/')({
  loader: ({ params, context }) =>
    context.mode.isLive ? loadLanding({ data: params.mode }) : null,
  component: ModeHome,
})

function ModeHome() {
  const { mode } = Route.useParams()
  const { mode: modeCtx } = Route.useRouteContext()
  const data = Route.useLoaderData()
  // Non-live modes render ComingSoon in the parent layout; no data here.
  if (!data) return null
  return <ModeLanding mode={mode} modeName={modeCtx.name} data={data} />
}
