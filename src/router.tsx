import {
  createRouter as createTanStackRouter,
  stringifySearchWith,
} from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // No parser arg: the default one re-quotes any string that JSON-parses
    // (?rank="4"), breaking the canonical bare-string URLs. Scalars serialize
    // bare; validators canonicalize parsed types back via asParam.
    stringifySearch: stringifySearchWith(JSON.stringify),
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
