export interface MusicMeta {
  id: string
  name: string
  album: string
  artist: string
  url: string
  pic: string
  lyric: string
}

export interface LoadMusicOptions {
  /**
   * Fully-qualified asset CDN host (e.g. `cat.yufan.me`). Caller threads
   * this in from `useAssetsSettings()?.asset.host` so the client
   * bundle does not need a hidden global config lookup.
   */
  assetHost: string
  /** `'http'` or `'https'`, also from the blog-config snapshot. */
  assetScheme: 'http' | 'https'
}

export async function loadMusic(id: string, { assetHost, assetScheme }: LoadMusicOptions): Promise<MusicMeta | null> {
  try {
    const resp = await fetch(`${assetScheme}://${assetHost}/musics/${id}.json`)
    if (resp.ok) {
      return (await resp.json()) as MusicMeta
    }
    return null
  } catch {
    return null
  }
}
