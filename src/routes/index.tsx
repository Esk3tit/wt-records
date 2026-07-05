import { createFileRoute, redirect } from '@tanstack/react-router'

const DEFAULT_MODE = 'grb'

// The home IS the default mode's landing. Serving it at / too split the
// page across two URLs (duplicate content, no active mode pill); temporary
// redirect so / can become the cross-mode hall once a second mode is live.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/$mode', params: { mode: DEFAULT_MODE } })
  },
})
