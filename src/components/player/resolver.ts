import { getSongInfo, getSongUrl } from '@/components/player/netease/song';

export type Song = {
  name: string;
  artist: string;
  url: string;
  pic: string;
};

// The props for music player. We support both netease music and direct linked music.
export interface MusicPlayerProps {
  netease?: number;
  song?: Song;
}

const emptySong = { name: '', artist: '', url: '', pic: '' };

const song = async (props: MusicPlayerProps): Promise<Song> => {
  const { netease, song } = props;

  if (netease) {
    const info = await getSongInfo(netease);
    const url = await getSongUrl(netease);

    // Check the return result.
    return { name: info[0].title, artist: info[0].author, url: url, pic: info[0].pic };
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
