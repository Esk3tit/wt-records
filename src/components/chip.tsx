import type { ReactNode } from 'react'

// The metadata chip register: informative, never alarming. One vocabulary for
// every vehicle tag so no surface invents its own.
export function Chip({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <span
      className="ml-1.5 rounded bg-tint-strong px-1.5 py-0.5 text-xs tracking-wide text-fg-faint uppercase"
      title={title}
    >
      {children}
    </span>
  )
}
