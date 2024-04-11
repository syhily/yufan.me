import { NextRequest, NextResponse } from 'next/server';

import { getLyric } from '@/components/netease/lyric';
import { getSongInfo, getSongUrl } from '@/components/netease/song';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (id === null) {
    return NextResponse.json({});
  }

  const songUrl = await getSongUrl(id);
  const songLrc = await getLyric(id);
  const songInfo = await getSongInfo(id);

  return NextResponse.json({ ...songInfo, url: songUrl, lrc: songLrc.lyric });
}
