import type { PublicMusicMeta } from '@/shared/music'

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
  const url = `/api/music/get?id=${encodeURIComponent(id)}`
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
  let body: { music?: MusicMeta }
  try {
    body = (await resp.json()) as { music?: MusicMeta }
  } catch {
    return null
  }
  return body.music ?? null
}
