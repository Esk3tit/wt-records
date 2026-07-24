import { useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ImagePlus, Loader2 } from 'lucide-react'
import { MAX_AVATAR_BYTES } from '#/storage/image-types'
import { errorMessage } from '#/lib/errors'
import { removeMyAvatar, uploadMyAvatar } from '#/claims/api'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif'

const ghostButton =
  'inline-flex items-center justify-center gap-1.5 rounded border border-hairline-soft px-3 py-1.5 text-sm font-semibold text-fg-muted transition-colors duration-200 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50'

/* The owner's avatar controls, shown only on their own Player page. Upload
   (or replace) a picture, or remove it to return to the Medallion. The server
   decodes, crops, and re-encodes — there is no client-side cropper. */
export function OwnerAvatarControls({
  playerId,
  hasAvatar,
}: {
  playerId: number
  hasAvatar: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
      return
    }
    // The write committed: reload so the new avatar (or the Medallion) renders.
    await router.invalidate().catch(() => undefined)
    setBusy(false)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the owner re-pick the same file after an error
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Keep the image under 5 MB.')
      return
    }
    const form = new FormData()
    form.set('playerId', String(playerId))
    form.set('avatar', file)
    void run(() => uploadMyAvatar({ data: form }))
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        className={ghostButton}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <ImagePlus size={15} aria-hidden />
        )}
        {hasAvatar ? 'Replace photo' : 'Upload photo'}
      </button>
      {hasAvatar && (
        <button
          type="button"
          className="text-sm font-semibold text-fg-muted underline decoration-hairline underline-offset-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => void run(() => removeMyAvatar({ data: { playerId } }))}
        >
          Remove
        </button>
      )}
      <p className="basis-full text-xs text-fg-faint">
        JPEG, PNG, WebP, GIF, or AVIF, up to 5 MB — cropped to a square.
      </p>
      {error && (
        <p role="alert" className="basis-full text-sm text-status-danger">
          {error}
        </p>
      )}
    </div>
  )
}
