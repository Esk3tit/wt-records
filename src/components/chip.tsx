import type { ReactNode } from 'react'

// Full ink, unlike the ink ramp's usual answer for metadata, and a fill that
// recesses rather than lightens: a chip lays its own fill under its own text,
// so on night glass a white one spends the very contrast the ink still needs —
// full ink over it still measured 4.08 on a lit pane, and no ink clears that.
// Day already darkens; this is that, in the other mode. Size, case and tracking
// are what keep it quiet here.
export function Chip({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <span
      className="chip-well rounded px-1.5 py-0.5 text-xs tracking-[0.05em] text-fg uppercase"
      title={title}
    >
      {children}
    </span>
  )
}
