import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ModeLanding } from '#/components/mode-landing'
import { db } from '#/db'
import { getModeLanding } from '#/db/queries'

const DEFAULT_MODE = 'grb'

const loadHome = createServerFn({ method: 'GET' }).handler(() =>
  getModeLanding(db, DEFAULT_MODE),
)

export const Route = createFileRoute('/')({
  loader: () => loadHome(),
  component: Home,
})

// The home page IS the default mode's landing (GRB at launch).
function Home() {
  const data = Route.useLoaderData()
  return (
    <ModeLanding
      mode={DEFAULT_MODE}
      modeName={data.modeName ?? 'Ground Realistic Battles'}
      data={data}
    />
  )
}
