import type { PublicMusicMeta } from '@/shared/music'

import { api } from '@/client/api/client'

// Browser-side resolver for `<MusicPlayer />`. Uses the ts-rest client.

export type MusicMeta = PublicMusicMeta

export async function loadMusic(id: string): Promise<MusicMeta | null> {
  try {
    const result = await api.music.get({ query: { id } })
    if (result.status === 200) {
      return (result.body as unknown as { music?: MusicMeta }).music ?? null
    }
    return null
  } catch {
    return null
  }
}
