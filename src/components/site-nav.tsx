import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Brand } from '#/components/brand'
import { ThemeToggle } from '#/components/theme-toggle'

export interface ModeNavItem {
  mode: string
  name: string
  isLive: boolean
}

const NAV_STICKY_INSET = 16

/** How far content must slide under the nav before it turns solid, and how far
    it must retreat before it clears. The gap between them is the deadband that
    stops scroll jitter at the boundary from strobing the state. */
const TURNS_SOLID_AFTER = 64
const CLEARS_BEFORE = 24

/** Measures the floating nav and drives both things that depend on its height:
    the published `--nav-h` (it wraps, so anything pinning below it needs a
    measured offset) and the lines where the pane turns solid, which are read
    off the nav's own bottom edge rather than a constant that could drift. */
function useNavPane() {
  const navRef = useRef<HTMLElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [navBottom, setNavBottom] = useState(0)
  const [solid, setSolid] = useState(false)
  const [live, setLive] = useState(false)

  /* The pane only animates in answer to the reader's own scrolling. A restored
     scroll position settles the state before any input arrives, so it is
     already solid on arrival rather than fading in behind the page. */
  useEffect(() => {
    const go = () => setLive(true)
    const opts = { once: true, passive: true } as const
    const events = ['wheel', 'touchmove', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, go, opts))
    return () => events.forEach((e) => window.removeEventListener(e, go))
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const publish = () => {
      const { height } = el.getBoundingClientRect()
      document.documentElement.style.setProperty('--nav-h', `${height}px`)
      setNavBottom(NAV_STICKY_INSET + height)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !navBottom) return
    const lineAt = (overlap: number) =>
      `-${Math.max(0, navBottom - overlap)}px 0px 0px 0px`
    /* Only a sentinel that has left past the TOP means content is under the
       nav; one below the fold has simply not been reached yet. */
    const arm = new IntersectionObserver(
      ([entry]) => {
        const { rootBounds, boundingClientRect, isIntersecting } = entry
        if (isIntersecting) return
        if (!rootBounds || boundingClientRect.top < rootBounds.top)
          setSolid(true)
      },
      { rootMargin: lineAt(TURNS_SOLID_AFTER) },
    )
    const disarm = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setSolid(false),
      { rootMargin: lineAt(CLEARS_BEFORE) },
    )
    arm.observe(el)
    disarm.observe(el)
    return () => {
      arm.disconnect()
      disarm.disconnect()
    }
  }, [navBottom])

  return { navRef, sentinelRef, solid, live }
}

export function SiteNav({
  modes,
  isModerator = false,
}: {
  modes: ModeNavItem[]
  isModerator?: boolean
}) {
  const { mode: activeMode } = useParams({ strict: false })
  const { navRef, sentinelRef, solid, live } = useNavPane()

  return (
    <>
      <header
        ref={navRef}
        data-solid={solid || undefined}
        data-live={live || undefined}
        className="nav-pane glass-thin sticky top-4 z-40 mx-auto mt-4 flex w-full max-w-[67.5rem] flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] py-2.5 pr-3 pl-5 [&_a]:no-underline"
      >
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
      {/* Marks where content begins, so the pane's solid state is measured
        against real overlap rather than a scroll distance. */}
      <div aria-hidden ref={sentinelRef} className="-mb-px h-px" />
    </>
  )
}
