// A failed image fetch INSIDE the renderer crashes the whole render, so resolve
// remote art here, out of band: any miss → null → the card renders art-less.
const TIMEOUT_MS = 3500
const MAX_BYTES = 4_000_000

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
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
