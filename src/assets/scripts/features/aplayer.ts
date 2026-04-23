import APlayer from 'aplayer-ts'

import { loadMusic } from '@/components/mdx/music/loader'

// Initialize APlayer instances for any `.aplayer` element with a data-id.
// Skips elements lacking metadata to avoid throwing in-page.
export async function initAPlayer(): Promise<void> {
  for (const p of document.querySelectorAll<HTMLTableElement>('.aplayer')) {
    if (p.dataset.id === undefined) continue

    const meta = await loadMusic(p.dataset.id)
    if (meta === null) continue

    APlayer().init({
      container: p,
      lrcType: 1,
      loop: 'none',
      audio: {
        name: meta.name,
        artist: meta.artist,
        url: meta.url,
        cover: meta.pic,
        theme: '#008c95',
        lrc: meta.lyric,
      },
    })
  }
}
