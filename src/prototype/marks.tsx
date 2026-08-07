import * as flags from 'country-flag-icons/string/3x2'
import * as si from 'simple-icons'
import { Globe } from 'lucide-react'

/* THROWAWAY — profile-v2 prototype (#160). Not shipped. */

export function CountryMark({
  code,
  name,
  size = 20,
  className = '',
}: {
  code: string
  name: string
  size?: number
  className?: string
}) {
  const svg = (flags as Record<string, string>)[code]
  if (!svg) return null
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="block shrink-0 overflow-hidden rounded-[2px]"
        style={{
          width: size,
          height: (size * 2) / 3,
          // #156: an inset edge shadow, never a border — a border would cost a
          // control its .tap-reach hit area.
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.28), inset 0 0 0 2px rgba(255,255,255,0.10)',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span>{name}</span>
    </span>
  )
}

export interface LinkItem {
  platform: string
  handle: string
}

// #167: chip colour is per-platform and per-lighting-state. Two forces decide it:
// the sanctioned backing colour, and whether the mark knocks its detail out to
// transparent (a black plate would repaint YouTube's play triangle black).
type Plate = 'white' | 'black' | 'ink'

const MARKS: Record<
  string,
  { icon?: { path: string; hex: string }; plate: Plate; label: string; wordmark?: string }
> = {
  youtube: { icon: si.siYoutube, plate: 'white', label: 'YouTube' },
  twitch: { icon: si.siTwitch, plate: 'white', label: 'Twitch' },
  kick: { icon: si.siKick, plate: 'black', label: 'Kick' },
  x: { icon: si.siX, plate: 'white', label: 'X' },
  discord: { icon: si.siDiscord, plate: 'white', label: 'Discord' },
  bluesky: { icon: si.siBluesky, plate: 'white', label: 'Bluesky' },
  tiktok: { plate: 'ink', label: 'TikTok', wordmark: 'TikTok' },
  site: { plate: 'ink', label: 'Personal site' },
}

export const PLATFORM_LABEL = (p: string) => MARKS[p]?.label ?? p

/* One link's mark on its opaque plate. `mark` is the mark's own box — Kick's
   published floor is 40px, which sets the plate for the whole row. */
export function BrandPlate({ platform, mark = 40 }: { platform: string; mark?: number }) {
  const m = MARKS[platform]
  if (!m) return null
  const box = Math.round(mark * 1.2)
  const plateBg =
    m.plate === 'white' ? '#FFFFFF' : m.plate === 'black' ? '#000000' : 'var(--tint-well)'
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[10px]"
      style={{
        width: box,
        height: box,
        background: plateBg,
        boxShadow: m.plate === 'ink' ? 'inset 0 0 0 1px var(--hairline-soft)' : undefined,
      }}
    >
      {m.icon ? (
        <svg
          viewBox="0 0 24 24"
          width={mark}
          height={mark}
          fill={`#${m.icon.hex}`}
          role="presentation"
        >
          <path d={m.icon.path} />
        </svg>
      ) : m.wordmark ? (
        <span
          className="text-fg-muted"
          style={{ fontSize: Math.round(mark * 0.42), fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          {m.wordmark}
        </span>
      ) : (
        <Globe size={Math.round(mark * 0.62)} className="text-fg-muted" />
      )}
    </span>
  )
}

/* A whole link: plate + the handle in the site's own ink. The handle is the
   anti-impersonation signal (#157) and must never be hover-only. */
export function ProfileLink({
  item,
  mark = 40,
  stacked = false,
}: {
  item: LinkItem
  mark?: number
  stacked?: boolean
}) {
  return (
    <a
      href="#"
      rel="me ugc nofollow noopener"
      className={`tap-reach group inline-flex min-w-0 items-center gap-2.5 rounded-[10px] ${
        stacked ? 'w-full' : ''
      }`}
    >
      <BrandPlate platform={item.platform} mark={mark} />
      <span className="min-w-0 truncate text-sm font-medium text-fg-muted group-hover:text-fg">
        {item.handle}
      </span>
      <span className="sr-only">on {PLATFORM_LABEL(item.platform)}</span>
    </a>
  )
}
