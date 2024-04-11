'use client';
import 'aplayer-react/dist/index.css';

import { APlayer } from 'aplayer-react';
import useSWR from 'swr';

const fetcher = (id: string) => fetch('/api/songs?id=' + id).then((res) => res.json());

export function NeteasePlayer({ id }: Readonly<{ id: string }>) {
  const { data, error, isLoading } = useSWR(id, fetcher);

  if (isLoading) {
    return <p>网易云音乐加载 ing</p>;
  }

  if (error || !data || !data.title) {
    console.log(error);
    return <p>网易云音乐加载失败 ❌</p>;
  }

  return (
    <APlayer
      audio={{
        name: data.title,
        artist: data.author,
        cover: data.pic,
        url: data.url,
        lrc: data.lrc,
      }}
    />
  );
}
