import type { ReactNode, WheelEvent } from 'react'

/* Shared control register for the CMS: one look for every admin surface. */

const fieldBase =
  'rounded border border-hairline-soft bg-[var(--pill-track)] px-3 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:border-[var(--glass-edge)]'

export const inputClass = fieldBase + ' w-full'

// No width baked in: selects size to their content unless a call site adds one.
export const selectClass = fieldBase + ' appearance-auto'

export const buttonClass =
  'rounded bg-[var(--pill-active)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-fg no-underline transition-colors duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'

/** The ONE amber action per view — form submit / dialog confirm. Amber fills
    carry black text in both modes; everything else stays in the grey register. */
export const commitButtonClass =
  'rounded bg-accent px-3.5 py-1.5 text-[0.8125rem] font-semibold text-black no-underline transition-[filter] duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'

export const subtleButtonClass =
  'rounded border border-hairline-soft px-3.5 py-1.5 text-[0.8125rem] font-semibold text-fg-muted no-underline transition-colors duration-200 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50'

export const dangerButtonClass =
  'rounded border border-[var(--status-danger-border)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-status-danger transition-colors duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'

/** A scrolling moderator must never edit a kill count by accident. */
export const blurOnWheel = (e: WheelEvent<HTMLInputElement>) =>
  e.currentTarget.blur()

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
    <section className="glass-thin rounded-[22px] p-5">
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
    <p role="alert" className="mt-3 text-sm text-status-danger">
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
  // Exception-first ledger: the norm (verified · current) stays quiet so the
  // rows that need eyes — pending, retired, superseded — are the ones that
  // carry color.
  const [label, tone] =
    status === 'verified'
      ? isCurrent
        ? ['current', 'text-fg-muted']
        : ['superseded', 'text-fg-faint']
      : status === 'retired'
        ? ['retired', 'text-status-danger']
        : status === 'pending'
          ? ['pending', 'text-status-warn']
          : [status, 'text-status-warn']
  return (
    <span className={`text-xs tracking-wide uppercase ${tone}`}>{label}</span>
  )
}
