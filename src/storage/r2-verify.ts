import process from 'node:process'
import { storageFromEnv } from '#/storage/r2'

// E2E round trip against the real R2 buckets; needs the R2_* env vars
// (bun run loads .env). Prints no secrets.
const storage = storageFromEnv()
const key = `verify/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
const body = new TextEncoder().encode(`wt-records r2 verify ${key}`)
const roles = ['pending', 'proofs'] as const

function ok(step: string) {
  console.log(`PASS ${step}`)
}

async function expectBody(step: string, bytes: Uint8Array | null) {
  if (!bytes || Buffer.compare(bytes, body) !== 0) {
    throw new Error(`${step}: fetched bytes do not match what was uploaded`)
  }
  ok(step)
}

async function fetchBytes(step: string, url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${step} returned ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

try {
  for (const role of roles) {
    await storage.put(role, key, body, 'text/plain')
    ok(`put ${role}`)
    await expectBody(`get ${role}`, await storage.get(role, key))
  }

  const signed = await storage.signedGetUrl('pending', key, 300)
  await expectBody('signed GET pending', await fetchBytes('signed GET', signed))

  const publicUrl = storage.publicUrl('proofs', key)
  await expectBody(
    'public GET via CDN',
    await fetchBytes('public GET', publicUrl),
  )

  for (const role of roles) {
    await storage.delete(role, key)
    if ((await storage.get(role, key)) !== null) {
      throw new Error(`delete ${role}: object still present`)
    }
    ok(`delete ${role}`)
  }

  console.log('R2 round trip verified.')
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
} finally {
  // A failed run must not strand verify objects in the real buckets.
  await Promise.allSettled(roles.map((role) => storage.delete(role, key)))
}
