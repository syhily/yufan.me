import { get_lyric } from './netease/lyric';
import { get_song_info, get_song_url } from './netease/song';

export type Song = {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc: string;
};

// The props for music player. We support both netease music and direct linked music.
export interface MusicPlayerProps {
  netease?: string;
  song?: Song;
}

const emptySong = { name: '', artist: '', url: '', pic: '', lrc: '' };

const song = async (props: MusicPlayerProps): Promise<Song> => {
  const { netease, song } = props;

  if (netease) {
    const info = await get_song_info(netease);
    const url = await get_song_url(netease);
    const lrc = await get_lyric(netease);

    // Check the return result.
    return { name: info[0].title, artist: info[0].author, url: url, pic: info[0].pic, lrc: lrc.lyric };
  }

  if (song) {
    return song;
  }

  console.error('No song information is provided, check your code.');
  return emptySong;
};

export const resolveSong = async (props: MusicPlayerProps): Promise<Song> => {
  // Try-catch for avoiding the unexpected errors.
  try {
    return await song(props);
  } catch (e) {
    return emptySong;
  }
};
