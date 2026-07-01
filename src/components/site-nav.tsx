import { Link, useParams } from '@tanstack/react-router'
import { Brand } from '#/components/brand'

export interface ModeNavItem {
  mode: string
  name: string
  isLive: boolean
}

export function SiteNav({ modes }: { modes: ModeNavItem[] }) {
  const { mode: activeMode } = useParams({ strict: false })

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-6 py-3">
      <Link to="/" className="text-lg">
        <Brand />
      </Link>
      <nav className="flex items-center gap-1">
        {modes.map((m) => (
          <Link
            key={m.mode}
            to="/$mode"
            params={{ mode: m.mode }}
            className={
              'rounded px-2 py-1 text-sm ' +
              (m.mode === activeMode ? 'text-accent' : 'text-fg-muted')
            }
          >
            {m.mode.toUpperCase()}
          </Link>
        ))}
      </nav>
      <Link to="/search" className="ml-auto text-sm text-fg-muted">
        Search
      </Link>
    </header>
  )
}
