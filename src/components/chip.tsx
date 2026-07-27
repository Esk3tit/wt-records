import type { ReactNode } from 'react'

// The metadata chip register: informative, never alarming. One vocabulary for
// every vehicle tag so no surface invents its own.
// Muted rather than faint ink: the chip lays its own fill under the text, and
// faint over that stack lands at 4.33 night / 4.44 day — under the AA floor.
export function Chip({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <span
      className="ml-1.5 rounded bg-tint-strong px-1.5 py-0.5 text-xs tracking-[0.05em] text-fg-muted uppercase"
      title={title}
    >
      {children}
    </span>
  )
}
