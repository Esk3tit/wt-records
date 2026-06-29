import { createFileRoute } from '@tanstack/react-router'
import { Brand } from '#/components/brand'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">
        <Brand />
      </h1>
      <p className="mt-4 text-lg">
        Public world-record registry for War Thunder. More routes and data are
        coming soon.
      </p>
    </div>
  )
}
