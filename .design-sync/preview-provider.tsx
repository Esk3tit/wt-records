import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function PreviewProvider({ children }: { children: ReactNode }) {
  const rootRoute = createRootRoute({ component: () => <>{children}</> })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return <RouterProvider router={router as never} />
}
