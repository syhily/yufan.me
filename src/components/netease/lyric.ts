import { request } from '@/components/netease/util';

export const getLyric = async (id: string) => {
  const data = {
    id: id,
    tv: -1,
    lv: -1,
    rv: -1,
    kv: -1,
  };
  const res = await request('POST', `https://music.163.com/api/song/lyric?_nmclfl=1`, data, {
    crypto: 'api',
  });

  return {
    lyric: res.lrc?.lyric || '',
    tlyric: res.tlyric?.lyric || '',
  };
};
