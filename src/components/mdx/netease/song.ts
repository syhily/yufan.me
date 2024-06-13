import { request } from '@/components/mdx/netease/util';

export const getSongUrl = async (id: string) => {
  const data = {
    ids: '[' + id + ']',
    level: 'standard',
    encodeType: 'flac',
  };

  const res = await request('POST', `https://interface.music.163.com/eapi/song/enhance/player/url/v1`, data, {
    crypto: 'eapi',
    url: '/api/song/enhance/player/url/v1',
    cookie: {},
  });
  const url = res.data[0]?.url?.replace('http://', 'https://');
  return url || `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};
