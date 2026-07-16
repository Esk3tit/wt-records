import type { ReactNode } from 'react'

/* Shared control register for the CMS: one look for every admin surface. */

export const inputClass =
  'w-full rounded-[10px] border border-hairline-soft bg-[var(--pill-track)] px-3 py-1.5 text-sm text-fg outline-hidden placeholder:text-fg-faint focus:border-[var(--glass-edge)]'

export const selectClass = inputClass + ' appearance-auto'

export const buttonClass =
  'rounded-[10px] bg-[var(--pill-active)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-fg transition-colors duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'

export const subtleButtonClass =
  'rounded-[10px] border border-hairline-soft px-3.5 py-1.5 text-[0.8125rem] font-semibold text-fg-muted transition-colors duration-200 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50'

export const dangerButtonClass =
  'rounded-[10px] border border-red-400/40 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-red-300 transition-colors duration-200 hover:border-red-400/70 disabled:cursor-not-allowed disabled:opacity-50'

export function Panel({
  title,
  aside,
  children,
}: {
  title?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="glass-thin rounded-[20px] p-5">
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="section-label">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs tracking-wide text-fg-faint uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-faint">{hint}</span>}
    </label>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="mt-3 text-sm text-red-300">
      {error}
    </p>
  )
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function StatusChip({
  status,
  isCurrent,
}: {
  status: string
  isCurrent: boolean
}) {
  const tone =
    status === 'verified'
      ? isCurrent
        ? 'text-emerald-300'
        : 'text-fg-muted'
      : status === 'retired'
        ? 'text-red-300'
        : 'text-amber-300'
  return (
    <span className={`text-xs tracking-wide uppercase ${tone}`}>
      {status}
      {isCurrent ? ' · current' : ''}
    </span>
  )
}
