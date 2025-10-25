import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import * as eapi from './providers/eapi'

export const storage = createStorage({
  driver: memoryDriver(),
})

export interface Song {
  netease: string
  name: string
  artist: string
  pic: string
  lyric: string
  url: string
}

export type SongWithoutURL = Omit<Song, 'url'>

export type SongInfo = Pick<Song, 'name' | 'artist' | 'pic'>

// The props for music player. We support both netease music and direct linked music.
export interface MusicPlayerProps extends Partial<SongWithoutURL> {
  netease: string
  premium?: boolean
}

export async function resolveSongWithoutURL(props: MusicPlayerProps): Promise<SongWithoutURL> {
  const { netease } = props
  const result = { netease, name: '', artist: '', pic: '', lyric: '' }
  try {
    const info = await eapi.getSongInfo(netease)
    result.name = info.name
    result.artist = info.artist
    result.pic = info.pic

    const lyric = await eapi.getLyrics(netease)
    result.lyric = lyric || '[00:00.00]无歌词'
  }
  catch (err) {
    console.error(err)
  }
  return result
}

async function loadMusicURL(netease: string, urlLoader: (id: string) => Promise<string | null>): Promise<string | null> {
  const cacheKey = `netease-music-url-${netease}`
  let url = await storage.getItem<string>(cacheKey)
  if (url) {
    return url
  }
  url = await urlLoader(netease)
  if (url) {
    await storage.setItem<string>(cacheKey, url, { ttl: 10 * 60 })
  }
  return url
}

export async function resolveSongURL(props: MusicPlayerProps): Promise<string> {
  const { netease } = props
  let result = ''
  try {
    const url = await loadMusicURL(netease, (id: string) => eapi.getSongUrl(id, 'standard'))
    result = url || ''
  }
  catch (err) {
    console.error(err)
  }
  return result
}
