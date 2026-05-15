import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { loadMusic } from '@/client/api/music-loader'
import { API_ACTIONS } from '@/shared/api-actions'

// `loadMusic` is the browser-side resolver fed straight into APlayer.
// It MUST go through the internal API so feed-cache headers and the
// install-gate stay in effect; the legacy `cat.yufan.me/musics/<id>.json`
// origin lookup is gone.

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('client/music — loadMusic', () => {
  it('hits the internal music.get endpoint and returns the unwrapped meta', async () => {
    const meta = {
      id: 'abcdef0123456789',
      name: 'Hello',
      artist: 'Adele',
      album: '25',
      url: 'https://cdn.example.com/musics/abcdef0123456789.mp3?v=1',
      pic: 'https://cdn.example.com/musics/abcdef0123456789.jpg?v=1',
      lyric: '[00:00.000]Hello',
    }
    const calls: string[] = []
    globalThis.fetch = (async (input: string) => {
      calls.push(input)
      return new Response(JSON.stringify({ music: meta }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const out = await loadMusic('abcdef0123456789')

    expect(out).toEqual(meta)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${API_ACTIONS.music.get.path}?id=abcdef0123456789`)
  })

  it('returns null on a 404 envelope', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 })) as unknown as typeof fetch
    const out = await loadMusic('nonexistent000000')
    expect(out).toBeNull()
  })

  it('returns null when fetch rejects', async () => {
    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const out = await loadMusic('abcdef0123456789')
    expect(out).toBeNull()
  })

  it('encodes the id query parameter', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (input: string) => {
      calls.push(input)
      return new Response(JSON.stringify({ music: null }), { status: 200 })
    }) as unknown as typeof fetch

    await loadMusic('weird id with spaces')

    expect(calls[0]).toContain('weird%20id%20with%20spaces')
  })
})
