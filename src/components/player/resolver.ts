export type Song = {
  name: string;
  artist: string;
  url: string;
  pic: string;
};

// The props for music player. We support both netease music and direct linked music.
export interface MusicPlayerProps {
  netease?: string;
  song?: Song;
}

const emptySong = { name: '', artist: '', url: '', pic: '' };

const song = async (props: MusicPlayerProps): Promise<Song> => {
  const { netease, song } = props;

  if (netease) {
    // https://github.com/injahow/meting-api
    const data = await fetch(`https://api.injahow.cn/meting/?type=song&id=${netease}`)
      .then((response) => response.json())
      .catch((e) => {
        console.log(e);
        return [emptySong];
      });

    return data[0] as Song;
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
