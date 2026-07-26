const USER_AGENT = 'wt-records-catalog-sync (+https://wtrecords.gg)'
const MAX_ATTEMPTS = 3
const REASON_MAX = 200
const REASON_MAX_READS = 16
const REASON_READ_TIMEOUT_MS = 2000

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
    const reason = await failureReason(response) // also releases the connection
    const error = new Error(
      `GET ${url} → ${response.status}${reason ? `: ${reason}` : ''}`,
    )
    const transient = response.status >= 500 || response.status === 429
    if (!transient) throw error
    lastError = error
  }
  throw lastError
}

/** An upstream's own reason ("SQLITE_CORRUPT…") is what makes a 500 actionable;
    binary bodies are skipped so image fetches can't spray bytes into the log. */
async function failureReason(response: Response): Promise<string> {
  const type = response.headers.get('content-type') ?? ''
  const reader = response.body?.getReader()
  if (!reader) return ''
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined
  try {
    if (!/json|text|xml|^$/i.test(type)) return ''
    // One deadline for the whole read, not per chunk: collecting a short
    // diagnostic must never cost the retry loop more than this, stall or not.
    const expired = new Promise<'expired'>((resolve) => {
      deadlineTimer = setTimeout(
        () => resolve('expired'),
        REASON_READ_TIMEOUT_MS,
      )
    })
    const decoder = new TextDecoder()
    let reason = ''
    for (let read = 0; read < REASON_MAX_READS; read++) {
      const chunk = await Promise.race([reader.read(), expired])
      if (chunk === 'expired' || chunk.done) break
      // Decode only what can still fit, so one huge chunk can't be materialized
      // in full; 4 is UTF-8's worst-case bytes per character.
      const budget = (REASON_MAX - reason.length) * 4
      const overflows = chunk.value.length > budget
      const bytes = overflows ? chunk.value.subarray(0, budget) : chunk.value
      reason = (reason + decoder.decode(bytes, { stream: true }))
        .replace(/\s+/g, ' ')
        .trimStart()
      // A truncated chunk left the decoder mid-character, so stop here rather
      // than splicing the next chunk onto a partial one.
      if (overflows || reason.length >= REASON_MAX) break
    }
    return reason.trim().slice(0, REASON_MAX)
  } catch {
    return ''
  } finally {
    clearTimeout(deadlineTimer)
    await reader.cancel().catch(() => undefined) // release the connection
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
