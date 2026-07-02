import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import { getMode } from '#/db/queries'
import { ComingSoon } from '#/components/coming-soon'

const loadMode = createServerFn({ method: 'GET' })
  .validator((mode: string) => mode)
  .handler(({ data }) => getMode(db, data))

export const Route = createFileRoute('/$mode')({
  beforeLoad: async ({ params }) => {
    const mode = await loadMode({ data: params.mode })
    if (!mode) throw notFound()
    // Only expose what the layout + child gates use — beforeLoad context is
    // dehydrated into the SSR payload, so the full row would leak a non-live
    // mode's staged rulesMd/difficultMinKills.
    return { mode: { name: mode.name, isLive: mode.isLive } }
  },
  component: ModeLayout,
})

function ModeLayout() {
  const { mode } = Route.useRouteContext()
  if (!mode.isLive) return <ComingSoon modeName={mode.name} />
  return <Outlet />
}
