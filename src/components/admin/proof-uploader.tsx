import { useRef, useState } from 'react'
import {
  Field,
  inputClass,
  selectClass,
  subtleButtonClass,
} from '#/components/admin/ui'

/* One uploader for both flows — new entry and attach-to-existing-record.
   Files stay in the form until save; the server proxies them to R2. */

export interface ProofDraft {
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

  const setFile = (index: number, patch: Partial<ProofDraft>) => {
    onChange({
      ...value,
      files: value.files.map((f, i) => (i === index ? { ...f, ...patch } : f)),
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
          PNG / JPEG / WebP / GIF / AVIF, up to 10 MB each
        </span>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []).map((file) => ({
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

      {value.files.length > 0 && (
        <ul className="space-y-2">
          {value.files.map((draft, i) => (
            <li
              key={`${draft.file.name}-${i}`}
              className="flex flex-wrap items-center gap-2 rounded-[10px] border border-hairline-soft px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {draft.file.name}
              </span>
              <label className="sr-only" htmlFor={`${idPrefix}-kind-${i}`}>
                Proof kind
              </label>
              <select
                id={`${idPrefix}-kind-${i}`}
                value={draft.kind}
                onChange={(e) =>
                  setFile(i, { kind: e.target.value as ProofDraft['kind'] })
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
                    files: value.files.filter((_, j) => j !== i),
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
                  onChange={(e) => setFile(i, { originalUrl: e.target.value })}
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
