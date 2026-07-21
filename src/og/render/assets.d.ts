// Vite `?inline` on a binary asset yields a base64 data-URI string baked into
// the JS bundle — the bytes travel with the code, so no runtime file read (and
// nothing for the server bundler to drop). Server-only OG asset loading.
declare module '*.ttf?inline' {
  const dataUri: string
  export default dataUri
}
declare module '*.png?inline' {
  const dataUri: string
  export default dataUri
}
