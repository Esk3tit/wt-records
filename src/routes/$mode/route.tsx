import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import { getMode } from '#/db/queries'
import { ComingSoon } from '#/components/coming-soon'
import { LiveSignalsContext } from '#/realtime/live-signals-context'
import { useLiveModeSignals } from '#/realtime/use-live-mode-signals'

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
  const params = Route.useParams()
  // One subscription per tab for the whole mode-world: any records event in
  // this mode re-runs whichever page's loader is active (ADR 0006).
  const live = useLiveModeSignals(params.mode, mode.isLive)
  if (!mode.isLive) return <ComingSoon modeName={mode.name} />
  return (
    <LiveSignalsContext.Provider value={live}>
      <Outlet />
    </LiveSignalsContext.Provider>
  )
}
