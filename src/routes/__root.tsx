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
import { ConsentBanner } from '#/components/consent-banner'
import { SiteNav } from '#/components/site-nav'
import { db } from '#/db'
import { listModes } from '#/db/queries'

const CANONICAL_ORIGIN = 'https://wtrecords.gg'

const loadModes = createServerFn({ method: 'GET' }).handler(async () => {
  const modes = await listModes(db)
  return modes.map((m) => ({ mode: m.mode, name: m.name, isLive: m.isLive }))
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
  loader: () => loadModes(),
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const modes = Route.useLoaderData()
  return (
    <>
      <SiteNav modes={modes} />
      <main>
        <Outlet />
      </main>
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    startObservability()
  }, [])

  return (
    <html lang="en">
      <head>
        {/* Pin the canonical host so the recordswt.com 301 redirect can't
            compete in unfurls/indexing. */}
        <link rel="canonical" href={`${CANONICAL_ORIGIN}${pathname}`} />
        <HeadContent />
      </head>
      <body>
        {children}
        <ConsentBanner />
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
