import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ImgurResolver, classifyProofUrl } from '#/migration/imgur'

describe('classifyProofUrl', () => {
  it('classifies the corpus URL shapes', () => {
    expect(classifyProofUrl('https://imgur.com/a/u1TwBBf')).toEqual({
      kind: 'imgur-album',
      imgurId: 'u1TwBBf',
    })
    expect(
      classifyProofUrl('https://imgur.com/gallery/some-title-AbC123'),
    ).toEqual({
      kind: 'imgur-album',
      imgurId: 'AbC123',
    })
    expect(classifyProofUrl('https://imgur.com/xYz987')).toEqual({
      kind: 'imgur-image',
      imgurId: 'xYz987',
    })
    expect(classifyProofUrl('https://youtu.be/eS5CRwrQKjo?si=x')).toEqual({
      kind: 'video',
    })
    expect(classifyProofUrl('https://www.youtube.com/watch?v=x')).toEqual({
      kind: 'video',
    })
    expect(classifyProofUrl('https://www.twitch.tv/videos/123')).toEqual({
      kind: 'video',
    })
    expect(classifyProofUrl('https://www.bilibili.com/video/BV1')).toEqual({
      kind: 'video',
    })
    expect(classifyProofUrl('https://example.com/whatever')).toEqual({
      kind: 'unknown',
    })
    expect(classifyProofUrl('not a url')).toEqual({ kind: 'unknown' })
  })
})

describe('ImgurResolver', () => {
  let dir: string
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const albumBody = {
    id: 'abc123',
    created_at: '2023-05-01T10:00:00Z',
    media: [
      {
        id: 'img1',
        url: 'https://i.imgur.com/img1.png',
        ext: 'png',
        created_at: '2023-05-01T10:00:00Z',
      },
      { id: 'img2', ext: 'jpeg', created_at: '2023-05-01T10:00:05Z' },
    ],
  }

  function makeResolver(fetchImpl: typeof fetch) {
    dir = mkdtempSync(join(tmpdir(), 'imgur-cache-'))
    return new ImgurResolver({
      cacheDir: dir,
      fetchImpl,
      throttleMs: 0,
      sleepImpl: () => Promise.resolve(),
    })
  }

  it('resolves an album, constructs missing media URLs, and caches on disk', async () => {
    const calls: Array<string> = []
    const resolver = makeResolver((async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify(albumBody), { status: 200 })
    }) as typeof fetch)

    const first = await resolver.resolve('abc123')
    expect(first).toEqual({
      id: 'abc123',
      status: 'ok',
      createdAt: '2023-05-01T10:00:00Z',
      media: [
        {
          id: 'img1',
          url: 'https://i.imgur.com/img1.png',
          ext: 'png',
          createdAt: '2023-05-01T10:00:00Z',
        },
        {
          id: 'img2',
          url: 'https://i.imgur.com/img2.jpeg',
          ext: 'jpeg',
          createdAt: '2023-05-01T10:00:05Z',
        },
      ],
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/post/v1/albums/abc123')
    expect(readdirSync(dir)).toEqual(['abc123.json'])

    const second = await resolver.resolve('abc123')
    expect(second).toEqual(first)
    expect(calls).toHaveLength(1)
  })

  it('falls back to the media endpoint for single-image posts', async () => {
    const calls: Array<string> = []
    const resolver = makeResolver((async (url: string) => {
      calls.push(url)
      if (url.includes('/albums/')) return new Response('', { status: 404 })
      return new Response(
        JSON.stringify({ ...albumBody, media: [albumBody.media[0]] }),
        { status: 200 },
      )
    }) as typeof fetch)

    const resolved = await resolver.resolve('abc123')
    expect(resolved.status).toBe('ok')
    expect(resolved.media).toHaveLength(1)
    expect(calls).toHaveLength(2)
  })

  it('marks 404-on-both-endpoints posts dead and caches the verdict', async () => {
    let calls = 0
    const resolver = makeResolver(async () => {
      calls += 1
      return new Response('', { status: 404 })
    })

    const resolved = await resolver.resolve('deadbeef')
    expect(resolved).toEqual({
      id: 'deadbeef',
      status: 'dead',
      httpStatus: 404,
      createdAt: null,
      media: [],
    })
    expect(calls).toBe(2)
    await resolver.resolve('deadbeef')
    expect(calls).toBe(2)
  })

  it('retries transient failures and eventually aborts without caching', async () => {
    let calls = 0
    const resolver = makeResolver(async () => {
      calls += 1
      return new Response('', { status: 503 })
    })

    await expect(resolver.resolve('flaky1')).rejects.toThrow(
      'after 5 attempts (HTTP 503)',
    )
    expect(calls).toBe(5)
    expect(readdirSync(dir)).toEqual([])
  })

  it('rejects path-unsafe ids', async () => {
    const resolver = makeResolver(fetch)
    await expect(resolver.resolve('../etc')).rejects.toThrow('Unsafe imgur id')
  })
})
