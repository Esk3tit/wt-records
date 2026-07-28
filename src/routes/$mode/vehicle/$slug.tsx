import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ProofGallery } from '#/components/proof-gallery'
import { TitleDeed } from '#/components/title-deed'
import { TitleHistory } from '#/components/title-history'
import { db } from '#/db'
import { getVehicle } from '#/db/queries'
import { toVehicleCardModel } from '#/og/props/vehicle'
import { vehicleUnfurl } from '#/og/copy'
import { vehicleCardUrl } from '#/og/urls'
import { cardMeta } from '#/og/meta'

const loadVehicle = createServerFn({ method: 'GET' })
  .validator((data: { mode: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const vehicle = await getVehicle(db, data.mode, data.slug)
    if (!vehicle) throw notFound()
    return vehicle
  })

export const Route = createFileRoute('/$mode/vehicle/$slug')({
  loader: ({ params, context }) =>
    context.mode.isLive
      ? loadVehicle({ data: { mode: params.mode, slug: params.slug } })
      : null,
  // Coming-soon mode → loaderData null → keep the site card (root defaults).
  head: ({ loaderData, params }) => {
    if (!loaderData) return {}
    const model = toVehicleCardModel(params.mode, loaderData)
    const { title, description } = vehicleUnfurl(model)
    return {
      meta: cardMeta({
        title,
        description,
        image: vehicleCardUrl(params.mode, params.slug, model.version),
      }),
    }
  },
  component: VehicleDetail,
})

function VehicleDetail() {
  const { mode } = Route.useParams()
  const data = Route.useLoaderData()
  if (!data) return null
  const { vehicle, br, current, proofs, history, titleSteps, minKills } = data

  return (
    <div className="py-6">
      <TitleDeed
        mode={mode}
        vehicle={vehicle}
        br={br}
        current={current}
        minKills={minKills}
      />
      <ProofGallery proofs={proofs} archived={current?.verifiedAt != null} />
      <TitleHistory rows={history} steps={titleSteps} />
    </div>
  )
}
