// A failed image fetch INSIDE the renderer crashes the whole render, so resolve
// remote art here, out of band: any miss → null → the card renders art-less.
const TIMEOUT_MS = 3500
const MAX_BYTES = 4_000_000

// Read the body with a hard byte cap so an oversized (or lying) response is
// aborted mid-stream, never fully buffered — the content-length header is only a
// fast-path reject, the streamed tally is the real bound.
async function readCapped(res: Response): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BYTES) return null
  const reader = res.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export async function resolveArt(url: string | null): Promise<string | null> {
  if (!url) return null
  const ctrl = new AbortController()
  // Kept armed until the body is fully read: a server can send headers promptly
  // then stall the body, so clearing on fetch() alone wouldn't bound the read.
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/png'
    if (!type.startsWith('image/')) return null
    const buf = await readCapped(res)
    if (!buf || buf.byteLength === 0) return null
    return `data:${type};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
