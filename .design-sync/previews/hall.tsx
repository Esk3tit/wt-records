import type { ReactNode } from 'react'

/* Shared card surface for every preview: the capture harness body is white,
   the DS is dark-first, so each cell brings its own Night Hangar backdrop.
   Keep content width ≤ ~44rem or it clips at the capture card edge. */
export function Hall({
  children,
  width,
}: {
  children: ReactNode
  width?: string
}) {
  return (
    <div
      className="rounded-[26px] bg-base p-8 text-fg"
      style={width ? { width } : undefined}
    >
      {children}
    </div>
  )
}
