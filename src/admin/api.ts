import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import { lookupVehicles } from '#/db/queries'
import { adminGate, requireModerator } from '#/admin/guard'
import {
  attachProofs,
  createRecord,
  demoteRecord,
  getAdminRecord,
  getEntryContext,
  listAdminRecords,
  makeCurrentRecord,
  previewTitleChange,
  retireRecord,
  reverifyRecord,
  updateRecord,
} from '#/admin/records'
import type {
  AdminRecordFilters,
  ProofRowInput,
  RecordUpdateInput,
  TitlePreviewRequest,
} from '#/admin/records'
import {
  getAdminPlayer,
  listAdminPlayers,
  mergePlayers,
  renamePlayer,
  addAlias,
  removeAlias,
  searchAdminPlayers,
} from '#/admin/players'
import {
  addPatch,
  listAdminVehicles,
  listPatchOptions,
  listRulesConfig,
  setVehicleDifficult,
  updateModeRules,
} from '#/admin/catalog'
import { listAudit } from '#/admin/audit'
import type { AuditEntity } from '#/admin/audit'
import {
  deleteProofObjects,
  uploadProofFiles,
  validateProofFile,
} from '#/admin/proofs'
import type { ImageProofKind, ProofFileInput } from '#/admin/proofs'
import { storageFromEnv } from '#/storage/r2'
import { proofUrlIfConfigured } from '#/storage/urls'
import type { VehicleClass } from '#/lib/vehicle-classes'

/* Every mutating/reading admin fn calls requireModerator() first — the only
   gate there is (ADR 0008). */

export const getAdminGate = createServerFn({ method: 'GET' }).handler(() =>
  adminGate(),
)

/* ── Records ─────────────────────────────────────────────────── */

export const adminRecordList = createServerFn({ method: 'GET' })
  .validator((data: AdminRecordFilters) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return listAdminRecords(db, data)
  })

export const adminRecordDetail = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data }) => {
    await requireModerator()
    const detail = await getAdminRecord(db, data)
    if (!detail) return null
    return {
      ...detail,
      proofs: detail.proofs.map((p) => ({
        ...p,
        url:
          (p.storagePath && proofUrlIfConfigured(p.storagePath)) ||
          p.originalUrl,
      })),
    }
  })

export const adminTitlePreview = createServerFn({ method: 'POST' })
  .validator((data: TitlePreviewRequest) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return previewTitleChange(db, data)
  })

export const adminUpdateRecord = createServerFn({ method: 'POST' })
  .validator((data: { recordId: number; patch: RecordUpdateInput }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return updateRecord(db, userId, data.recordId, data.patch)
  })

export const adminRetireRecord = createServerFn({ method: 'POST' })
  .validator((data: { recordId: number; reason: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return retireRecord(db, userId, data.recordId, data.reason)
  })

export const adminReverifyRecord = createServerFn({ method: 'POST' })
  .validator((data: { recordId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return reverifyRecord(db, userId, data.recordId)
  })

export const adminMakeCurrent = createServerFn({ method: 'POST' })
  .validator((data: { recordId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return makeCurrentRecord(db, userId, data.recordId)
  })

export const adminDemoteRecord = createServerFn({ method: 'POST' })
  .validator((data: { recordId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return demoteRecord(db, userId, data.recordId)
  })

/* ── Multipart save: validate → PUT to R2 → one insert transaction; the
      uploaded objects are deleted if anything after them fails. ── */

const IMAGE_PROOF_KINDS = new Set(['scoreboard', 'end_game', 'end_life'])

interface ParsedProofUpload {
  files: ProofFileInput[]
  videoUrl: string | null
}

async function parseProofForm(form: FormData): Promise<ParsedProofUpload> {
  const uploads = form.getAll('proofFile')
  const kinds = form.getAll('proofKind').map(String)
  const originals = form.getAll('proofOriginalUrl').map(String)
  const files: ProofFileInput[] = []
  for (let i = 0; i < uploads.length; i++) {
    const file = uploads[i]
    if (!(file instanceof File)) throw new Error('Malformed proof upload')
    const kind = kinds[i]
    if (!IMAGE_PROOF_KINDS.has(kind)) {
      throw new Error(`Unknown proof kind ${kind}`)
    }
    validateProofFile({ contentType: file.type, size: file.size })
    files.push({
      kind: kind as ImageProofKind,
      contentType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      originalUrl: originals[i]?.trim() || null,
    })
  }
  for (const f of files) {
    if (f.originalUrl && !/^https?:\/\//.test(f.originalUrl)) {
      throw new Error('A provenance link must be an http(s) URL')
    }
  }
  const videoUrl = String(form.get('videoUrl') ?? '').trim() || null
  if (videoUrl && !/^https?:\/\//.test(videoUrl)) {
    throw new Error('Video proof must be an http(s) URL')
  }
  return { files, videoUrl }
}

async function uploadedProofRows(
  parsed: ParsedProofUpload,
): Promise<ProofRowInput[]> {
  const storage = parsed.files.length > 0 ? storageFromEnv() : null
  const rows: ProofRowInput[] = storage
    ? await uploadProofFiles(storage, parsed.files)
    : []
  if (parsed.videoUrl)
    rows.push({ kind: 'video', originalUrl: parsed.videoUrl })
  return rows
}

async function rollbackUploads(rows: ProofRowInput[]): Promise<void> {
  const keys = rows.flatMap((r) => (r.storagePath ? [r.storagePath] : []))
  if (keys.length > 0) await deleteProofObjects(storageFromEnv(), keys)
}

function formString(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
}

function formNumber(form: FormData, name: string): number | null {
  const raw = formString(form, name)
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`)
  return n
}

/** Owns the multipart invariant: parse + validate, upload to R2, run the DB
    write, and delete the uploaded objects if that write fails. */
async function withUploadedProofs<T>(
  form: FormData,
  write: (proofs: ProofRowInput[]) => Promise<T>,
): Promise<T> {
  const proofs = await uploadedProofRows(await parseProofForm(form))
  try {
    return await write(proofs)
  } catch (error) {
    try {
      await rollbackUploads(proofs)
    } catch (cleanupError) {
      // Cleanup must never mask the write error; the stray keys are logged.
      console.warn('proof rollback failed', cleanupError)
    }
    throw error
  }
}

export const adminSaveRecord = createServerFn({ method: 'POST' })
  .validator((data: FormData) => data)
  .handler(async ({ data: form }) => {
    const { userId } = await requireModerator()
    return withUploadedProofs(form, (proofs) =>
      createRecord(db, userId, {
        mode: formString(form, 'mode'),
        vehicleId: formNumber(form, 'vehicleId') ?? 0,
        playerId: formNumber(form, 'playerId'),
        newPlayerName: formString(form, 'newPlayerName') || null,
        ignSnapshot: formString(form, 'ignSnapshot'),
        kills: formNumber(form, 'kills') ?? 0,
        patch: formString(form, 'patch'),
        runBr: formNumber(form, 'runBr'),
        proofs,
      }),
    )
  })

export const adminAttachProofs = createServerFn({ method: 'POST' })
  .validator((data: FormData) => data)
  .handler(async ({ data: form }) => {
    const { userId } = await requireModerator()
    const recordId = formNumber(form, 'recordId')
    if (recordId == null) throw new Error('recordId is required')
    return withUploadedProofs(form, (proofs) =>
      attachProofs(db, userId, recordId, proofs),
    )
  })

/* ── Entry-form context ──────────────────────────────────────── */

export const adminVehicleLookup = createServerFn({ method: 'GET' })
  .validator((data: { mode: string; q: string }) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return lookupVehicles(db, data.mode, data.q)
  })

export const adminEntryContext = createServerFn({ method: 'GET' })
  .validator((data: { mode: string; vehicleSlug: string }) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return getEntryContext(db, data.mode, data.vehicleSlug)
  })

export const adminPlayerPrefill = createServerFn({ method: 'GET' })
  .validator((playerId: number) => playerId)
  .handler(async ({ data }) => {
    await requireModerator()
    const detail = await getAdminPlayer(db, data)
    return detail ? { lastIgn: detail.lastIgn } : null
  })

/* ── Players ─────────────────────────────────────────────────── */

export const adminPlayerSearch = createServerFn({ method: 'GET' })
  .validator((q: string) => q)
  .handler(async ({ data }) => {
    await requireModerator()
    return searchAdminPlayers(db, data)
  })

export const adminPlayerList = createServerFn({ method: 'GET' })
  .validator((data: { q?: string; offset?: number }) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return listAdminPlayers(db, data)
  })

export const adminPlayerDetail = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data }) => {
    await requireModerator()
    return getAdminPlayer(db, data)
  })

export const adminRenamePlayer = createServerFn({ method: 'POST' })
  .validator((data: { playerId: number; displayName: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return renamePlayer(db, userId, data.playerId, data.displayName)
  })

export const adminAddAlias = createServerFn({ method: 'POST' })
  .validator(
    (data: { playerId: number; name: string; kind?: 'ign' | 'display' }) =>
      data,
  )
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return addAlias(db, userId, data.playerId, data.name, data.kind)
  })

export const adminRemoveAlias = createServerFn({ method: 'POST' })
  .validator((data: { aliasId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return removeAlias(db, userId, data.aliasId)
  })

export const adminMergePlayers = createServerFn({ method: 'POST' })
  .validator((data: { survivorId: number; duplicateId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return mergePlayers(db, userId, data)
  })

/* ── Catalog & rules ─────────────────────────────────────────── */

export const adminVehicleList = createServerFn({ method: 'GET' })
  .validator(
    (data: { q?: string; difficultOnly?: boolean; offset?: number }) => data,
  )
  .handler(async ({ data }) => {
    await requireModerator()
    return listAdminVehicles(db, data)
  })

export const adminSetDifficult = createServerFn({ method: 'POST' })
  .validator((data: { vehicleId: number; isDifficult: boolean }) => data)
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return setVehicleDifficult(db, userId, data.vehicleId, data.isDifficult)
  })

export const adminRulesConfig = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireModerator()
    return listRulesConfig(db)
  },
)

export const adminUpdateRules = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      mode: string
      entries: { class: VehicleClass; minKills: number | null }[]
      difficultMinKills: number | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return updateModeRules(db, userId, data.mode, {
      entries: data.entries,
      difficultMinKills: data.difficultMinKills,
    })
  })

/* ── Patches ─────────────────────────────────────────────────── */

export const adminPatchOptions = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireModerator()
    return listPatchOptions(db)
  },
)

export const adminAddPatch = createServerFn({ method: 'POST' })
  .validator(
    (data: { version: string; name?: string; releasedAt?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return addPatch(db, userId, {
      version: data.version,
      name: data.name ?? null,
      releasedAt: data.releasedAt ? new Date(data.releasedAt) : null,
    })
  })

/* ── Audit ───────────────────────────────────────────────────── */

export const adminAuditList = createServerFn({ method: 'GET' })
  .validator((data: { entity?: AuditEntity; offset?: number }) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return listAudit(db, data)
  })
