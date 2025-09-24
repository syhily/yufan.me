import { getLyrics, getSongInfo, getSongUrl } from './services'

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

export async function resolveSong(props: MusicPlayerProps): Promise<Song> {
  // Try-catch for avoiding the unexpected errors.
  try {
    const { netease } = props

    const info = await getSongInfo(netease)
    const url = await getSongUrl(netease, 'standard')
    const lyric = await getLyrics(netease)

    // Check the return result.
    return {
      name: info.name,
      artist: info.singer || '',
      url: url || '',
      pic: info.picimg || '',
      lyric: lyric || '[00:00.00]无歌词',
    }
  }
  catch (error) {
    console.error('Failed to resolve the song', error)
    return { name: '', artist: '', url: '', pic: '', lyric: '' }
  }
}
