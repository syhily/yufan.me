import { assetConfig } from '@/blog.config'

export interface MusicMeta {
  id: string
  name: string
  album: string
  artist: string
  url: string
  pic: string
  lyric: string
}

export async function loadMusic(id: string): Promise<MusicMeta | null> {
  try {
    const resp = await fetch(`${assetConfig.scheme}://${assetConfig.host}/musics/${id}.json`)
    if (resp.ok) {
      return await resp.json() as MusicMeta
    }
    return null
  }
  catch {
    return null
  }
}
