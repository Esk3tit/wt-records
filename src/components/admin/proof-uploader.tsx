import { useRef, useState } from 'react'
import {
  Field,
  inputClass,
  selectClass,
  subtleButtonClass,
} from '#/components/admin/ui'
import { RASTER_IMAGE_CONTENT_TYPES } from '#/storage/image-types'
import { MAX_PROOF_BYTES } from '#/admin/proofs'

/* One uploader for both flows — new entry and attach-to-existing-record.
   Files stay in the form until save; the server proxies them to R2. */

export interface ProofDraft {
  id: string
  file: File
  kind: 'scoreboard' | 'end_game' | 'end_life'
  originalUrl: string
}

export interface ProofDraftState {
  files: ProofDraft[]
  videoUrl: string
}

export const emptyProofDrafts: ProofDraftState = { files: [], videoUrl: '' }

const KIND_LABELS = {
  scoreboard: 'Scoreboard',
  end_game: 'End game',
  end_life: 'End life',
} as const

const ACCEPTED_FORMATS = [...RASTER_IMAGE_CONTENT_TYPES]
  .map((t) => t.split('/')[1].toUpperCase())
  .join(' / ')

export function appendProofFormData(form: FormData, drafts: ProofDraftState) {
  for (const draft of drafts.files) {
    form.append('proofFile', draft.file)
    form.append('proofKind', draft.kind)
    form.append('proofOriginalUrl', draft.originalUrl)
  }
  if (drafts.videoUrl.trim()) form.set('videoUrl', drafts.videoUrl.trim())
}

export function ProofUploader({
  value,
  onChange,
  idPrefix,
}: {
  value: ProofDraftState
  onChange: (next: ProofDraftState) => void
  idPrefix: string
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [showOriginals, setShowOriginals] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)

  const setFile = (draftId: string, patch: Partial<ProofDraft>) => {
    onChange({
      ...value,
      files: value.files.map((f) =>
        f.id === draftId ? { ...f, ...patch } : f,
      ),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => fileInput.current?.click()}
        >
          Add screenshot…
        </button>
        <span className="text-xs text-fg-faint">
          {ACCEPTED_FORMATS}, up to {MAX_PROOF_BYTES / 1024 / 1024} MB each
        </span>
        <input
          ref={fileInput}
          type="file"
          accept={[...RASTER_IMAGE_CONTENT_TYPES].join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            const all = Array.from(e.target.files ?? [])
            const oversized = all.filter((f) => f.size > MAX_PROOF_BYTES)
            setPickError(
              oversized.length > 0
                ? `Skipped over-limit file(s): ${oversized.map((f) => f.name).join(', ')}`
                : null,
            )
            const picked = all
              .filter((f) => f.size <= MAX_PROOF_BYTES)
              .map((file) => ({
                id: crypto.randomUUID(),
                file,
                kind: 'scoreboard' as const,
                originalUrl: '',
              }))
            if (picked.length > 0) {
              onChange({ ...value, files: [...value.files, ...picked] })
            }
            e.target.value = ''
          }}
        />
      </div>

      {pickError && (
        <p role="alert" className="text-xs text-status-warn">
          {pickError}
        </p>
      )}

      {value.files.length > 0 && (
        <ul className="space-y-2">
          {value.files.map((draft) => (
            <li
              key={draft.id}
              className="flex flex-wrap items-center gap-2 rounded-[10px] border border-hairline-soft px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {draft.file.name}
              </span>
              <label
                className="sr-only"
                htmlFor={`${idPrefix}-kind-${draft.id}`}
              >
                Proof kind
              </label>
              <select
                id={`${idPrefix}-kind-${draft.id}`}
                value={draft.kind}
                onChange={(e) =>
                  setFile(draft.id, {
                    kind: e.target.value as ProofDraft['kind'],
                  })
                }
                className={selectClass + ' w-auto'}
              >
                {Object.entries(KIND_LABELS).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`Remove ${draft.file.name}`}
                className="text-xs text-fg-muted hover:text-fg"
                onClick={() =>
                  onChange({
                    ...value,
                    files: value.files.filter((f) => f.id !== draft.id),
                  })
                }
              >
                Remove
              </button>
              {showOriginals && (
                <input
                  type="url"
                  value={draft.originalUrl}
                  placeholder="Original source URL (provenance, optional)"
                  className={inputClass + ' basis-full'}
                  onChange={(e) =>
                    setFile(draft.id, { originalUrl: e.target.value })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {value.files.length > 0 && !showOriginals && (
        <button
          type="button"
          className="text-xs text-fg-muted hover:text-fg"
          onClick={() => setShowOriginals(true)}
        >
          Add original source URLs…
        </button>
      )}

      <Field
        label="Video proof (URL)"
        hint="YouTube or similar — stored as a link."
      >
        <input
          type="url"
          value={value.videoUrl}
          placeholder="https://…"
          className={inputClass}
          onChange={(e) => onChange({ ...value, videoUrl: e.target.value })}
        />
      </Field>
    </div>
  )
}
