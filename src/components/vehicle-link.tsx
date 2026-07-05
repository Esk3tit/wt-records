import { Link } from '@tanstack/react-router'
import { RemovedTag } from '#/components/removed-tag'

export function VehicleLink({
  mode,
  slug,
  name,
  isRemoved,
}: {
  mode: string
  slug: string
  name: string
  isRemoved: boolean
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
      {isRemoved && <RemovedTag />}
    </>
  )
}
