import { request } from '@/components/player/netease/request';

const mapSongList = (song_list) => {
  return song_list.songs.map((song) => {
    const artists = song.ar || song.artists;
    return {
      title: song.name,
      author: artists.reduce((i, v) => (i ? `${i} / ` : i) + v.name, ''),
      pic: song?.al?.picUrl || song.id,
      url: song.id,
      lrc: song.id,
    };
  });
};

export const getSongUrl = async (id) => {
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
  const url = res.data[0]?.url?.replace('http://', 'https://');

  return url || `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};

export const getSongInfo = async (id) => {
  const ids = [id];
  const data = {
    c: `[${ids.map((id) => `{"id":${id}}`).join(',')}]`,
  };
  const res = await request('POST', 'https://music.163.com/api/v3/song/detail', data, {
    crypto: 'weapi',
  });

  if (!res.songs) {
    throw res;
  }

  return mapSongList(res);
};
