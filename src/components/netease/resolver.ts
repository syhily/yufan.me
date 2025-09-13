import { getHighResSongUrl, getLyrics, getSongInfo } from './services'

export interface Song {
  name: string
  artist: string
  url: string
  pic: string
  lyric: string
}

// The props for music player. We support both netease music and direct linked music.
export interface MusicPlayerProps {
  netease: string
}

async function song(props: MusicPlayerProps): Promise<Song> {
  const { netease } = props

  const info = await getSongInfo(netease)
  const url = await getHighResSongUrl(netease)
  const lyric = await getLyrics(netease)

  // Check the return result.
  return {
    name: info.name,
    artist: info.artists !== undefined ? info.artists[0].name : '',
    url: url || '',
    pic: info.album?.picUrl || '',
    lyric: lyric || '[00:00.00]无歌词',
  }
}

export async function resolveSong(props: MusicPlayerProps): Promise<Song> {
  // Try-catch for avoiding the unexpected errors.
  try {
    return await song(props)
  }
  catch (error) {
    console.error('Failed to resolve the song', error)
    return { name: '', artist: '', url: '', pic: '', lyric: '' }
  }
}
