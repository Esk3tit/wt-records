const USER_AGENT = 'wt-records-catalog-sync (+https://wtrecords.gg)'
const MAX_ATTEMPTS = 3

export interface UpstreamFetchOptions {
  fetchImpl?: typeof fetch
  /** Total attempts including the first (not "extra retries"). */
  maxAttempts?: number
  retryDelayMs?: number
  /** Per-attempt cap; unset = no timeout. */
  timeoutMs?: number
  /** Redirect policy; default follows. 'error' hardens SSRF-sensitive fetches. */
  redirect?: RequestRedirect
}

/** GET with the catalog user-agent and backoff retries on 429/5xx/network
    errors; a non-transient 4xx fails fast (retrying only adds load). */
export async function fetchUpstream(
  url: string,
  options: UpstreamFetchOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS
  const retryDelayMs = options.retryDelayMs ?? 1000

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await sleep(retryDelayMs * (attempt - 1))
    let response: Response
    try {
      response = await fetchImpl(url, {
        headers: { 'user-agent': USER_AGENT },
        redirect: options.redirect,
        signal:
          options.timeoutMs == null
            ? undefined
            : AbortSignal.timeout(options.timeoutMs),
      })
      if (response.ok) return response
    } catch (e) {
      lastError = e // network/timeout failure — worth retrying
      continue
    }
    await response.body?.cancel().catch(() => undefined) // release the connection
    const error = new Error(`GET ${url} → ${response.status}`)
    const transient = response.status >= 500 || response.status === 429
    if (!transient) throw error
    lastError = error
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
