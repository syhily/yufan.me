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
  netease?: string
  song?: Song
}

const emptySong = { name: '', artist: '', url: '', pic: '', lyric: '' }

async function song(props: MusicPlayerProps): Promise<Song> {
  const { netease, song } = props

  if (netease) {
    const info = await getSongInfo(netease)
    const url = await getHighResSongUrl(netease)
    const lyric = await getLyrics(netease)

    // Check the return result.
    return {
      name: info.name,
      artist: info.artists !== undefined ? info.artists[0].name : '',
      url: url || `https://music.163.com/song/media/outer/url?id=${netease}.mp3`,
      pic: info.album?.picUrl || '',
      lyric: lyric || '[00:00.00]无歌词',
    }
  }

  if (song) {
    return song
  }

  console.error('No song information is provided, check your code.')
  return emptySong
}

export async function resolveSong(props: MusicPlayerProps): Promise<Song> {
  // Try-catch for avoiding the unexpected errors.
  try {
    return await song(props)
  }
  catch (error) {
    console.error(error)
    return emptySong
  }
}
