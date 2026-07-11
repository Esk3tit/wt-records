export function assertValidObjectKey(key: string): void {
  const segments = key.split('/')
  const malformed =
    key === '' || segments.some((s) => s === '' || s === '.' || s === '..')
  if (malformed) throw new Error(`Invalid object key: ${JSON.stringify(key)}`)
}

export function publicObjectUrl(baseUrl: string, key: string): string {
  const path = key.split('/').map(encodeURIComponent).join('/')
  return `${baseUrl.replace(/\/+$/, '')}/${path}`
}

/** Serving URL for a mirrored asset — needs only the public base URL, never
    the bucket credentials, so read paths can build image URLs anywhere. */
export function assetUrl(key: string): string {
  const base = process.env.R2_ASSETS_BASE_URL
  if (!base) throw new Error('R2_ASSETS_BASE_URL is not set')
  assertValidObjectKey(key)
  return publicObjectUrl(base, key)
}

/** Serving URL for a mirrored proof (the public proofs bucket), or null when
    the base URL isn't configured — callers fall back to the original URL. */
export function proofUrlIfConfigured(key: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL
  if (!base) return null
  assertValidObjectKey(key)
  return publicObjectUrl(base, key)
}
