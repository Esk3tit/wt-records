import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { buttonClass, subtleButtonClass } from '#/components/admin/ui'

/* The auto-title confirm modal: every consequential write states its outcome
   ("saving this demotes X's 14-kill record") before anything is committed. */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean
  title: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="glass-thick m-auto w-full max-w-md rounded-[20px] p-6 text-fg backdrop:bg-black/50"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-fg-muted">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={subtleButtonClass} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
