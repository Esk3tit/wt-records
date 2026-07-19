import { useEffect } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'
import { startObservability } from '#/lib/observability'
import { THEME_INIT_SCRIPT } from '#/lib/theme'
import { ConsentBanner } from '#/components/consent-banner'
import { NationFlagSprite } from '#/components/nation-flag'
import { SceneBackdrop } from '#/components/scene-backdrop'
import { SiteNav } from '#/components/site-nav'
import { db } from '#/db'
import { listModes } from '#/db/queries'
import { hasAuthCookie } from '#/auth/supabase-server'
import { adminGate } from '#/admin/guard'

const CANONICAL_ORIGIN = 'https://wtrecords.gg'

const loadShell = createServerFn({ method: 'GET' }).handler(async () => {
  // The mod check short-circuits on the cookie so plain visitors never pay
  // an auth round-trip; an auth outage must never take the public site down,
  // so any gate failure just hides the chip.
  const [modes, isModerator] = await Promise.all([
    listModes(db),
    hasAuthCookie()
      ? adminGate().then(
          (gate) => gate.state === 'moderator',
          () => false,
        )
      : false,
  ])
  return {
    modes: modes.map((m) => ({ mode: m.mode, name: m.name, isLive: m.isLive })),
    isModerator,
  }
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'WT Records' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  loader: () => loadShell(),
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const { modes, isModerator } = Route.useLoaderData()
  return (
    <>
      <SceneBackdrop />
      <div className="relative z-[2] px-5 pb-24">
        <SiteNav modes={modes} isModerator={isModerator} />
        <main className="mx-auto w-full max-w-[67.5rem]">
          <Outlet />
        </main>
      </div>
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    startObservability()
  }, [])

  return (
    // The theme-init script stamps data-theme before hydration on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pin the canonical host so the recordswt.com 301 redirect can't
            compete in unfurls/indexing. */}
        <link rel="canonical" href={`${CANONICAL_ORIGIN}${pathname}`} />
        {/* Blocking on purpose: the theme must be stamped before first paint
            or a dark-preference visitor gets a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <NationFlagSprite />
        {children}
        {!pathname.startsWith('/admin') && <ConsentBanner />}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
