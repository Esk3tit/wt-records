// A failed image fetch INSIDE the renderer crashes the whole render, so resolve
// remote art here, out of band: any miss → null → the card renders art-less.
const TIMEOUT_MS = 3500
const MAX_BYTES = 4_000_000

export async function resolveArt(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(url, { signal: ctrl.signal }).finally(() =>
      clearTimeout(timer),
    )
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/png'
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
