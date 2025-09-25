import * as api from './providers/api'
import * as eapi from './providers/eapi'

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
  }
  catch (err) {
    console.error(err)
  }
  return result
}

export async function resolveSongURL(props: MusicPlayerProps): Promise<string> {
  const { netease, premium } = props
  let result = ''
  try {
    if (premium === undefined || !premium) {
      const url = await eapi.getSongUrl(netease, 'standard')
      result = url || ''
    }
  }
  catch (err) {
    console.error(err)
  }
  try {
    if (result === '') {
      const url = await api.getSongUrl(netease, 'standard')
      result = url || ''
    }
  }
  catch (err) {
    console.error(err)
  }
  return result
}
