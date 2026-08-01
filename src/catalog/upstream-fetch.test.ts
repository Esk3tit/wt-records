import { describe, expect, it, vi } from 'vitest'
import { fetchUpstream } from '#/catalog/upstream-fetch'

const URL_UNDER_TEST = 'https://wt.example/vehicles'

const reply = (
  status: number,
  body: BodyInit,
  contentType = 'application/json',
) => new Response(body, { status, headers: { 'content-type': contentType } })

const streamed = (
  status: number,
  chunks: Iterable<string>,
  contentType = 'application/json',
) => {
  const encoder = new TextEncoder()
  const iterator = chunks[Symbol.iterator]()
  const body = new ReadableStream({
    pull(controller) {
      const next = iterator.next()
      if (next.done) controller.close()
      else controller.enqueue(encoder.encode(next.value))
    },
  })
  return new Response(body, {
    status,
    headers: { 'content-type': contentType },
  })
}

function* endlessWhitespace(): Generator<string> {
  for (;;) yield ' '
}

/** Headers arrive, then the body never produces a chunk — a stalled upstream. */
const stalling = (status: number, contentType = 'application/json') =>
  new Response(
    new ReadableStream({
      pull: () => new Promise<never>(() => undefined),
    }),
    { status, headers: { 'content-type': contentType } },
  )

const stub = (...responses: Array<Response>) => {
  const calls: Array<string> = []
  const inits: Array<RequestInit | undefined> = []
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push(url)
    inits.push(init)
    return Promise.resolve(responses[calls.length - 1] ?? responses.at(-1)!)
  }) as unknown as typeof fetch
  return { fetchImpl, calls, inits }
}

const authHeader = (init: RequestInit | undefined) =>
  new Headers(init?.headers).get('authorization')

async function failureMessage(...responses: Array<Response>): Promise<string> {
  const { fetchImpl } = stub(...responses)
  try {
    await fetchUpstream(URL_UNDER_TEST, { fetchImpl, maxAttempts: 1 })
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('expected fetchUpstream to reject')
}

describe('fetchUpstream error context', () => {
  it('carries the upstream reason, not just the status', async () => {
    const message = await failureMessage(
      reply(500, '{"error":"SQLITE_CORRUPT: disk image is malformed"}'),
    )

    expect(message).toBe(
      `GET ${URL_UNDER_TEST} → 500: {"error":"SQLITE_CORRUPT: disk image is malformed"}`,
    )
  })

  it('reassembles a reason split across stream chunks', async () => {
    const message = await failureMessage(
      streamed(500, [
        '{"error":"SQLITE_',
        'CORRUPT: disk image',
        ' is malformed"}',
      ]),
    )

    expect(message).toBe(
      `GET ${URL_UNDER_TEST} → 500: {"error":"SQLITE_CORRUPT: disk image is malformed"}`,
    )
  })

  it('reads the body when the content-type is not lowercase', async () => {
    const message = await failureMessage(reply(500, 'boom', 'Text/Plain'))

    expect(message).toBe(`GET ${URL_UNDER_TEST} → 500: boom`)
  })

  it('never decodes more of a chunk than could fit in the reason', async () => {
    const decode = TextDecoder.prototype.decode
    const decodedSizes: Array<number> = []
    const spy = vi
      .spyOn(TextDecoder.prototype, 'decode')
      .mockImplementation(function (this: TextDecoder, input, options) {
        decodedSizes.push((input as Uint8Array | undefined)?.length ?? 0)
        return decode.call(this, input, options)
      })
    try {
      const message = await failureMessage(
        reply(500, 'A'.repeat(5_000_000), 'text/plain'),
      )

      // 200 characters of reason, at UTF-8's worst-case 4 bytes each.
      expect(Math.max(...decodedSizes)).toBeLessThanOrEqual(800)
      expect(message).toBe(`GET ${URL_UNDER_TEST} → 500: ${'A'.repeat(200)}`)
    } finally {
      spy.mockRestore()
    }
  })

  it('gives up on a body that never sends a chunk', async () => {
    vi.useFakeTimers()
    try {
      const pending = failureMessage(stalling(500))
      await vi.advanceTimersByTimeAsync(2000)
      expect(await pending).toBe(`GET ${URL_UNDER_TEST} → 500`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops reading an endless body instead of hanging', async () => {
    const message = await failureMessage(
      streamed(500, endlessWhitespace(), 'text/plain'),
    )

    expect(message).toBe(`GET ${URL_UNDER_TEST} → 500`)
  })

  it('collapses and truncates a runaway error page', async () => {
    const body = `<html>\n   <body>${'oops '.repeat(200)}</body>\n</html>`

    const message = await failureMessage(reply(502, body, 'text/html'))

    expect(message).toMatch(/→ 502: <html> <body>(oops ){10}/)
    expect(message.length).toBeLessThan(300)
  })

  it('keeps binary bodies out of the message', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    const message = await failureMessage(reply(500, png.buffer, 'image/png'))

    expect(message).toBe(`GET ${URL_UNDER_TEST} → 500`)
  })

  it('still fails fast on a non-transient status', async () => {
    const { fetchImpl, calls } = stub(reply(404, 'gone', 'text/plain'))

    await expect(
      fetchUpstream(URL_UNDER_TEST, {
        fetchImpl,
        maxAttempts: 3,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/→ 404: gone/)
    expect(calls).toHaveLength(1)
  })

  it('retries a 5xx and returns the eventual success', async () => {
    const { fetchImpl, calls } = stub(
      reply(500, 'down'),
      reply(200, '{"ok":true}'),
    )

    const response = await fetchUpstream(URL_UNDER_TEST, {
      fetchImpl,
      maxAttempts: 3,
      retryDelayMs: 0,
    })

    expect(await response.json()).toEqual({ ok: true })
    expect(calls).toHaveLength(2)
  })
})

describe('fetchUpstream GitHub authentication', () => {
  it('authenticates a GitHub API request when given a token', async () => {
    const { fetchImpl, inits } = stub(reply(200, '{"sha":"abc"}'))

    await fetchUpstream(
      'https://api.github.com/repos/gszabi99/War-Thunder-Datamine/commits/master',
      { fetchImpl, githubToken: 'ghp_secret' },
    )

    expect(authHeader(inits[0])).toBe('Bearer ghp_secret')
  })

  it('authenticates a raw.githubusercontent.com request', async () => {
    const { fetchImpl, inits } = stub(reply(200, '2.57.0.8', 'text/plain'))

    await fetchUpstream(
      'https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/master/version',
      { fetchImpl, githubToken: 'ghp_secret' },
    )

    expect(authHeader(inits[0])).toBe('Bearer ghp_secret')
  })

  // fetchUpstream is shared with the Imgur migration, avatar CDNs and a
  // WT_UNITS_CSV_URL that points anywhere — the token must not follow it there.
  it('never sends the token to a non-GitHub host', async () => {
    const { fetchImpl, inits } = stub(reply(200, 'name;English'))

    await fetchUpstream('https://i.imgur.com/abc.png', {
      fetchImpl,
      githubToken: 'ghp_secret',
    })

    expect(authHeader(inits[0])).toBeNull()
  })

  it.each([
    ['a suffix lookalike', 'https://evilgithub.com/repos/o/r'],
    ['a subdomain lookalike', 'https://api.github.com.evil.test/repos/o/r'],
    ['a subdomain of a real GitHub host', 'https://x.api.github.com/repos/o/r'],
    ['a substring of a real GitHub host', 'https://hub.com/repos/o/r'],
    ['userinfo naming a GitHub host', 'https://api.github.com@evil.test/x'],
    ['a trailing dot on a real GitHub host', 'https://api.github.com./repos'],
  ])('treats %s as foreign', async (_label, url) => {
    const { fetchImpl, inits } = stub(reply(200, '{}'))

    await fetchUpstream(url, { fetchImpl, githubToken: 'ghp_secret' })

    expect(authHeader(inits[0])).toBeNull()
  })

  it('treats a plaintext GitHub URL as foreign', async () => {
    const { fetchImpl, inits } = stub(reply(200, '{}'))

    await fetchUpstream('http://raw.githubusercontent.com/o/r/master/version', {
      fetchImpl,
      githubToken: 'ghp_secret',
    })

    expect(authHeader(inits[0])).toBeNull()
  })

  // A Headers rejection quotes the offending value, and that message reaches a
  // public issue via catalog_sync_runs.detail — so it must never hold a token.
  it('refuses a token outside the printable range, not throws it', async () => {
    const { fetchImpl, inits } = stub(reply(200, '{}'))

    await fetchUpstream('https://api.github.com/repos/o/r', {
      fetchImpl,
      githubToken: 'ghp_secret value',
    })

    expect(authHeader(inits[0])).toBeNull()
  })

  // Judging a token is GitHub's job; recognising its shape here would only
  // fail differently the next time the formats change.
  it('sends a header-safe token GitHub will reject anyway', async () => {
    const { fetchImpl, inits } = stub(reply(200, '{}'))

    await fetchUpstream('https://api.github.com/repos/o/r', {
      fetchImpl,
      githubToken: 'changeme',
    })

    expect(authHeader(inits[0])).toBe('Bearer changeme')
  })

  it('tolerates whitespace around the token', async () => {
    const { fetchImpl, inits } = stub(reply(200, '{}'))

    await fetchUpstream('https://api.github.com/repos/o/r', {
      fetchImpl,
      githubToken: '  ghp_secret\n',
    })

    expect(authHeader(inits[0])).toBe('Bearer ghp_secret')
  })

  it('sends no Authorization when no token is configured', async () => {
    const { fetchImpl, inits } = stub(reply(200, '{"sha":"abc"}'))

    await fetchUpstream('https://api.github.com/repos/o/r/commits/master', {
      fetchImpl,
    })

    expect(authHeader(inits[0])).toBeNull()
  })
})
