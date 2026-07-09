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
