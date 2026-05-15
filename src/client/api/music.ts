import type { PublicMusicMeta as MusicMeta } from '@/shared/music'

import { api } from '@/client/api/client'

/**
 * Fetch music metadata by id for the browser-side APlayer.
 * Goes through the internal /rpc/music.get RPC endpoint.
 */
export async function loadMusic(id: string): Promise<MusicMeta | null> {
  try {
    const res = await api.music.get({ id })
    return (res.music as MusicMeta | null) ?? null
  } catch {
    return null
  }
}
