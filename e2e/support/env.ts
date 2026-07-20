export const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

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

/** The setup project mints auth users and PROMOTES one to moderator. Pointed
    at the hosted project — the default in a working .env — that would write
    real users and a real moderator into production, so make it deliberate.
    Same shape as the seed/import runners' `*_REMOTE` guards. */
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
