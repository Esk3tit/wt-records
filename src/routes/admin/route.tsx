import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { buttonClass, subtleButtonClass } from '#/components/admin/ui'
import { getAdminGate } from '#/admin/api'

/* The one gated layout: the gate resolves server-side, so a
   non-moderator's SSR payload carries no admin data. Children re-check the
   gate from context before loading anything. */
export const Route = createFileRoute('/admin')({
  beforeLoad: async () => ({ gate: await getAdminGate() }),
  component: AdminShell,
  head: () => ({ meta: [{ title: 'Admin · WT Records' }] }),
})

const TABS = [
  { to: '/admin', label: 'Records', exact: true },
  { to: '/admin/players', label: 'Players', exact: false },
  { to: '/admin/catalog', label: 'Catalog & rules', exact: false },
  { to: '/admin/audit', label: 'Audit', exact: false },
] as const

function AdminShell() {
  const { gate } = Route.useRouteContext()

  if (gate.state === 'signed-out') {
    return (
      <section className="glass-thin mx-auto mt-16 max-w-md rounded-[20px] p-8 text-center">
        <h1 className="text-2xl font-semibold">Moderator sign-in</h1>
        <p className="mt-2 text-sm text-fg-muted">
          The CMS is for WT Records moderators. Sign in with the Discord account
          your moderator role is tied to.
        </p>
        <a href="/auth/login" className={buttonClass + ' mt-6 inline-block'}>
          Sign in with Discord
        </a>
      </section>
    )
  }

  if (gate.state === 'not-moderator') {
    return (
      <section className="glass-thin mx-auto mt-16 max-w-md rounded-[20px] p-8 text-center">
        <h1 className="text-2xl font-semibold">
          {gate.handle ? `Hi ${gate.handle}` : 'Signed in'} — not a moderator
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          This account has no moderator access. If it should, ask an existing
          moderator on Discord to promote it.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className={subtleButtonClass}>
            Back to the site
          </Link>
          <form method="post" action="/auth/logout">
            <button type="submit" className={subtleButtonClass}>
              Sign out
            </button>
          </form>
        </div>
      </section>
    )
  }

  return (
    <div className="mt-6">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-[var(--pill-active)] focus:px-3 focus:py-1.5 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold">Moderator CMS</h1>
        <nav
          aria-label="Admin sections"
          className="flex items-center gap-0.5 rounded-[13px] border border-hairline-soft bg-[var(--pill-track)] p-0.5"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.exact, includeSearch: false }}
              activeProps={{
                className:
                  'rounded-[10px] px-3.5 py-1.5 text-[0.8125rem] font-semibold bg-[var(--pill-active)] text-fg no-underline',
              }}
              inactiveProps={{
                className:
                  'rounded-[10px] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-fg-muted hover:text-fg no-underline',
              }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-fg-muted">
          {gate.handle && <span>{gate.handle}</span>}
          <form method="post" action="/auth/logout">
            <button type="submit" className="text-fg-muted hover:text-fg">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <div id="admin-content">
        <Outlet />
      </div>
    </div>
  )
}
