import { map_song_list, request } from './util.js';

export const get_song_url = async (id, cookie = '') => {
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

export const get_song_info = async (id, cookie = '') => {
  const ids = [id];
  const data = {
    c: `[${ids.map((id) => `{"id":${id}}`).join(',')}]`,
  };
  let res = await request('POST', 'https://music.163.com/api/v3/song/detail', data, {
    crypto: 'weapi',
  });

  if (!res.songs) {
    throw res;
  }

  res = map_song_list(res);
  return res;
};
