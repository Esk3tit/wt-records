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

// Last-good per-mode context: router.invalidate() re-runs beforeLoad on every
// realtime signal, and a background refresh must neither pay a loadMode round
// trip nor let a transient failure notFound a page that was rendering fine.
const modeCache = new Map<string, { name: string; isLive: boolean }>()

export const Route = createFileRoute('/$mode')({
  beforeLoad: async ({ params, cause }) => {
    const cached = modeCache.get(params.mode)
    if (cause === 'stay' && cached) return { mode: cached }
    const mode = await loadMode({ data: params.mode })
    if (!mode) throw notFound()
    // Only expose what the layout + child gates use — beforeLoad context is
    // dehydrated into the SSR payload, so the full row would leak a non-live
    // mode's staged rulesMd/difficultMinKills.
    const slim = { name: mode.name, isLive: mode.isLive }
    modeCache.set(params.mode, slim)
    return { mode: slim }
  },
  component: ModeLayout,
})

function ModeLayout() {
  const { mode } = Route.useRouteContext()
  const params = Route.useParams()
  // One subscription per tab for the whole mode-world: any records event in
  // this mode re-runs whichever page's loader is active.
  const live = useLiveModeSignals(params.mode, mode.isLive)
  if (!mode.isLive) return <ComingSoon modeName={mode.name} />
  return (
    <LiveSignalsContext.Provider value={live}>
      <Outlet />
    </LiveSignalsContext.Provider>
  )
}
