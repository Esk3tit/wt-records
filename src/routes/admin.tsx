import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({ component: Admin })

function Admin() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 text-fg-muted">
        Moderator CMS — auth and role gating land in a later PR.
      </p>
    </section>
  )
}
