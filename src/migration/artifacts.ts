/* Committed migration artifacts under data/migration/<mode>/ — the permanent
   provenance record of what was imported and every decision behind it. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface ArtifactPaths {
  dir: string
  cacheDir: string
  imgurCacheDir: string
  mirrorManifest: string
  snapshot: string
  findings: string
  patches: string
  rules: string
  overrides: string
  resolution: string
  review: string
}

export function artifactPaths(
  mode: string,
  root = 'data/migration',
): ArtifactPaths {
  const dir = join(root, mode)
  const cacheDir = join(dir, 'cache')
  return {
    dir,
    cacheDir,
    imgurCacheDir: join(cacheDir, 'imgur'),
    mirrorManifest: join(cacheDir, 'mirror-manifest.json'),
    snapshot: join(dir, 'snapshot.json'),
    findings: join(dir, 'findings.md'),
    patches: join(dir, 'patches.json'),
    rules: join(dir, 'rules.json'),
    overrides: join(dir, 'overrides.json'),
    resolution: join(dir, 'resolution.json'),
    review: join(dir, 'review.md'),
  }
}

export function readJsonArtifact<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`Missing artifact: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function readJsonArtifactIfExists<T>(path: string): T | null {
  return existsSync(path) ? readJsonArtifact<T>(path) : null
}

export function writeArtifact(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`)
}

export function writeJsonArtifact(path: string, value: unknown): void {
  writeArtifact(path, JSON.stringify(value, null, 2))
}
