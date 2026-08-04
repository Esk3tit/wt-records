import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'

/** Which checkout this suite belongs to — it names the stack lock's holder and
    keeps the server port clear of a sibling worktree's. */
export function checkoutRoot(): string {
  return join(import.meta.dirname, '..', '..')
}

export function checkoutName(): string {
  return basename(checkoutRoot())
}

// Read late, not at import time: the config loads .env after this module. The
// port is per checkout so a run can't reuse a sibling's server, or a dev one.
export function baseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${localPort()}`
}

export function localPort(): number {
  const digest = createHash('sha256').update(checkoutRoot()).digest()
  return 3100 + (digest.readUInt16BE(0) % 1000)
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is required to run the E2E suite. Locally: start the Supabase stack ` +
        `(bunx supabase start) and put its values in .env. In CI: see .github/workflows/e2e.yml.`,
    )
  }
  return value
}

/** Setup mints users and PROMOTES one to moderator, and a working .env points
    at the hosted project — so require a local target, like `SEED_REMOTE` does. */
export function assertDisposableTarget(): void {
  if (process.env.E2E_REMOTE === '1') return
  for (const name of ['SUPABASE_URL', 'DATABASE_URL']) {
    const value = requireEnv(name)
    if (!isLocalUrl(value)) {
      throw new Error(
        `refusing to provision E2E users against a non-local ${name} (${hostOf(value)}). ` +
          `Point it at the local Supabase stack, or set E2E_REMOTE=1 if this really is a throwaway target.`,
      )
    }
  }
}

function isLocalUrl(url: string): boolean {
  const host = hostOf(url)
  return host !== null && LOCAL_HOSTS.has(host)
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}
