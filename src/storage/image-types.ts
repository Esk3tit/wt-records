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

export const RASTER_IMAGE_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
])
