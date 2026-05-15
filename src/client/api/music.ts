import type { PublicMusicMeta as MusicMeta } from '@/shared/music'

import { api } from '@/client/api/client'

/**
 * Fetch music metadata by id for the browser-side APlayer.
 * Goes through the internal /api/music/get endpoint.
 */
export async function loadMusic(id: string): Promise<MusicMeta | null> {
  try {
    const res = await api.music.get({ query: { id } })
    if (res.status !== 200) {
      return null
    }
    return (res.body.music as MusicMeta | null) ?? null
  } catch {
    return null
  }
}
