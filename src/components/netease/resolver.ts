import * as api from './providers/api'
import * as eapi from './providers/eapi'

export interface Song {
  name: string
  artist: string
  url: string
  pic: string
  lyric: string
}

export type SongInfo = Pick<Song, 'name' | 'artist' | 'pic'>

// The props for music player. We support both netease music and direct linked music.
export interface MusicPlayerProps {
  netease: string
}

export async function resolveSong(props: MusicPlayerProps): Promise<Song> {
  const { netease } = props
  const result = { name: '', artist: '', pic: '', url: '', lyric: '' }
  try {
    const info = await eapi.getSongInfo(netease)
    result.name = info.name
    result.artist = info.artist
    result.pic = info.pic

    const lyric = await eapi.getLyrics(netease)
    result.lyric = lyric || '[00:00.00]无歌词'

    const url = await eapi.getSongUrl(netease, 'standard')
    result.url = url || ''
  }
  catch (err) {
    console.error(err)
  }
  try {
    if (result.name === '') {
      const info = await api.getSongInfo(netease)
      result.name = info.name
      result.artist = info.artist
      result.pic = info.pic
    }

    if (result.lyric === '') {
      const lyric = await api.getLyrics(netease)
      result.lyric = lyric || '[00:00.00]无歌词'
    }

    if (result.url === '') {
      const url = await api.getSongUrl(netease, 'standard')
      result.url = url || ''
    }
  }
  catch (err) {
    console.error(err)
  }
  return result
}
