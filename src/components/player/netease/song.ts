import { request } from '@/components/player/netease/request';

type SongUrl = {
  url?: string;
};

type SongUrlResponse = {
  data: SongUrl[];
};

export interface SongArtist {
  albumSize: number;
  id: number;
  img1v1Id: number;
  img1v1Url: string;
  musicSize: number;
  name: string;
  picId: number;
  picUrl: string;
  topicPerson: number;
  alias?: string[];
}

type SongInfo = {
  al: {
    id: number;
    name: string;
    picUrl: string;
  };
  ar: SongArtist[];
  dt: number;
  id: number;
  name: string;
  publishTime: number;
  fee?: number;
  status?: number;
};

type SongInfoResponse = {
  songs?: SongInfo[];
};

export const getSongUrl = async (id: number) => {
  const data = {
    ids: `[${id}]`,
    level: 'standard',
    encodeType: 'flac',
  };

  const res = await request('POST', 'https://interface.music.163.com/eapi/song/enhance/player/url/v1', data, {
    crypto: 'eapi',
    url: '/api/song/enhance/player/url/v1',
    cookie: {},
  });
  const url = (res as SongUrlResponse).data[0]?.url?.replace('http://', 'https://');

  return url || `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};

const mapSongList = (songs: SongInfo[]) => {
  return songs.map((song) => {
    const artists = song.ar || [];
    return {
      title: song.name,
      author: artists.reduce((i, v) => (i ? `${i} / ` : i) + v.name, ''),
      pic: song?.al?.picUrl || song.id,
      url: song.id,
      lrc: song.id,
    };
  });
};

export const getSongInfo = async (id: number) => {
  const ids = [id];
  const data = {
    c: `[${ids.map((id) => `{"id":${id}}`).join(',')}]`,
  };
  const res = (await request('POST', 'https://music.163.com/api/v3/song/detail', data, {
    crypto: 'weapi',
  })) as SongInfoResponse;

  if (!res.songs) {
    throw res;
  }

  return mapSongList(res.songs);
};
