import { getSongUrl } from '@/components/mdx/netease/song';

export async function NeteasePlayer({ id }: Readonly<{ id: string }>) {
  const songUrl = await getSongUrl(id);
  return <audio controls src={songUrl} />;
}
