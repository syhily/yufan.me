import type { PublicMusicMeta } from '@/shared/music'

import { API_ACTIONS } from '@/shared/api-actions'

// Browser-side resolver for `<MusicPlayer />`. Talks to the internal
// public GET endpoint (`/api/actions/music/get?id=<playerId>`), which
// returns the audio + cover URL pair (resolved against the configured
// S3 public base URL) plus the inline LRC text in a single payload.
//
// The legacy implementation reached for `https://<assetHost>/musics/
// <id>.json` directly; we keep the function signature pleasant for
// the player by accepting `id` only — assetHost / assetScheme are no
// longer needed.

export type MusicMeta = PublicMusicMeta

export async function loadMusic(id: string): Promise<MusicMeta | null> {
  const url = `${API_ACTIONS.music.get.path}?id=${encodeURIComponent(id)}`
  let resp: Response
  try {
    resp = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    return null
  }
  if (!resp.ok) {
    return null
  }
  let envelope: { data?: { music?: MusicMeta } }
  try {
    envelope = (await resp.json()) as { data?: { music?: MusicMeta } }
  } catch {
    return null
  }
  return envelope.data?.music ?? null
}
