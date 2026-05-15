import type { PublicMusicMeta as MusicMeta } from '@/shared/music'

/**
 * Fetch music metadata by id for the browser-side APlayer.
 * Goes through the internal /api/music/get endpoint.
 */
export async function loadMusic(id: string): Promise<MusicMeta | null> {
  try {
    const resp = await fetch(`/api/music/get?id=${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!resp.ok) {
      return null
    }
    const body = (await resp.json()) as { music?: MusicMeta }
    return body.music ?? null
  } catch {
    return null
  }
}
