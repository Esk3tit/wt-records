import type { ReactNode } from 'react'

export function SectionHead({
  title,
  aside,
}: {
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="section-label min-w-0 flex-1">{title}</h2>
      {aside != null && (
        <span className="text-[0.8125rem] text-fg-muted">{aside}</span>
      )}
    </div>
  )
}
