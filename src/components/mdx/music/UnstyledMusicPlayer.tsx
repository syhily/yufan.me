import { loadMusic } from '@/components/mdx/music/loader'

export interface UnstyledMusicPlayerProps {
  id: string
}

export async function UnstyledMusicPlayer({ id }: UnstyledMusicPlayerProps) {
  const meta = await loadMusic(id)
  const url = meta === null ? '' : meta.url
  if (url === '') return null
  return <audio controls src={url} />
}
