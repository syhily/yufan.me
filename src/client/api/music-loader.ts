import type { PublicMusicMeta } from '@/shared/music'

import { API_ACTIONS } from '@/shared/api-actions'

// Browser-side resolver for `<MusicPlayer />`. Talks to the Hono REST API
// endpoint which returns audio + cover URL pair plus inline LRC text.

export type MusicMeta = PublicMusicMeta

export async function loadMusic(id: string): Promise<MusicMeta | null> {
  const url = `${API_ACTIONS.music.get.path}?id=${encodeURIComponent(id)}`
  let resp: Response
  try {
    resp = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    return null
  }
  if (!resp.ok) {
    return null
  }
  try {
    const body = (await resp.json()) as { music?: MusicMeta }
    return body.music ?? null
  } catch {
    return null
  }
}
