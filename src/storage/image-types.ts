// Raster only — SVG is active content and must never be served from an
// owned origin with a third-party body. Shared by every mirror path.
export const RASTER_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'avif',
])

// Single source for the content-type allowlist AND the stored extension, so
// the two can't drift (a type accepted here always has an upload extension).
export const RASTER_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export const RASTER_IMAGE_CONTENT_TYPES = new Set(
  Object.keys(RASTER_EXTENSION_BY_CONTENT_TYPE),
)

// One cap for every avatar byte path — the provider seed and the owner upload.
// Lives here (no heavy deps) so the browser upload control can share it.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024
