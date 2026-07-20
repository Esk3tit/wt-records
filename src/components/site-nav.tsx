import { Link, useParams } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Brand } from '#/components/brand'
import { ThemeToggle } from '#/components/theme-toggle'

export interface ModeNavItem {
  mode: string
  name: string
  isLive: boolean
}

export function SiteNav({
  modes,
  isModerator = false,
}: {
  modes: ModeNavItem[]
  isModerator?: boolean
}) {
  const { mode: activeMode } = useParams({ strict: false })

  return (
    <header className="glass-thin sticky top-4 z-40 mx-auto mt-4 flex w-full max-w-[67.5rem] flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] py-2.5 pr-3 pl-5 [&_a]:no-underline">
      <Link to="/" className="text-[0.9375rem]">
        <Brand />
      </Link>
      <nav
        aria-label="Game modes"
        className="order-last flex w-full items-center gap-0.5 rounded-[13px] border border-hairline-soft bg-[var(--pill-track)] p-0.5 sm:order-none sm:ml-auto sm:w-auto"
      >
        {modes.map((m) => (
          <Link
            key={m.mode}
            to="/$mode"
            params={{ mode: m.mode }}
            aria-label={`${m.mode.toUpperCase()} · ${m.name}`}
            title={m.name}
            aria-current={m.mode === activeMode ? 'page' : undefined}
            className={
              'rounded-[10px] px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors duration-200 ' +
              (m.mode === activeMode
                ? 'bg-[var(--pill-active)] text-fg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]'
                : 'text-fg-muted hover:text-fg')
            }
          >
            {m.mode.toUpperCase()}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        {isModerator && (
          <Link
            to="/admin"
            className="rounded bg-tint-strong px-1.5 py-0.5 text-xs tracking-wide text-fg-muted uppercase transition-colors duration-200 hover:text-fg"
          >
            Admin
          </Link>
        )}
        <Link
          to="/search"
          aria-label="Search"
          className="rounded-[10px] p-2 text-fg-muted transition-colors duration-200 hover:text-fg"
        >
          <Search size={16} />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
