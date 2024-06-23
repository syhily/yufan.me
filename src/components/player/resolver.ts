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
    // Fix the UNABLE_TO_GET_ISSUER_CERT_LOCALLY issue for the mirror site.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    // https://github.com/injahow/meting-api
    const data = await fetch(`https://api.injahow.cn/meting/?type=song&id=${netease}`)
      .then((response) => response.json())
      .catch((e) => {
        console.error(e);
        return [emptySong];
      });

    // Check the return result.
    return { name: data[0].name, artist: data[0].artist, url: data[0].url, pic: data[0].pic };
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
