import type { ReactNode } from 'react'

// Full ink, unlike the ink ramp's usual answer for metadata: the chip lays its
// own lightening fill under the text, where muted measures 3.84 on thick glass.
// Size, case and tracking are what keep it quiet here.
export function Chip({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <span
      className="rounded bg-tint-strong px-1.5 py-0.5 text-xs tracking-[0.05em] text-fg uppercase"
      title={title}
    >
      {children}
    </span>
  )
}
