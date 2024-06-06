export type Song = {
  name: string;
  artist: string;
  url: string;
  pic: string;
};

export const song = async (id: string): Promise<Song> => {
  // https://github.com/injahow/meting-api
  const data = await fetch(`https://api.injahow.cn/meting/?type=song&id=${id}`, {})
    .then((response) => response.json())
    .catch((e) => {
      console.log(e);
      return [{ name: '', artist: '', url: '', pic: '' }];
    });

  return data[0] as Song;
};
