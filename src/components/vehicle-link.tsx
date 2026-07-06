import { Link } from '@tanstack/react-router'
import { VehicleTags } from '#/components/vehicle-tags'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export function VehicleLink({
  mode,
  slug,
  name,
  tags,
}: {
  mode: string
  slug: string
  name: string
  tags: VehicleTagFlags
}) {
  return (
    <>
      <Link
        to="/$mode/vehicle/$slug"
        params={{ mode, slug }}
        className="no-underline hover:underline"
      >
        {name}
      </Link>
      <VehicleTags tags={tags} />
    </>
  )
}
