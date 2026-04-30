import { useEffect, useRef } from 'react'

import { loadMusic } from '@/client/music'
import { requireBlogSettingsBundle } from '@/shared/blog-config-snapshot'
import { useLocalization } from '@/ui/lib/blog-config-context'

export interface MusicPlayerProps {
  id: string
}

// MDX-embeddable music player. Lazy-loads APlayer only when the component
// is actually mounted, so posts without music carry no aplayer.js payload.
export function MusicPlayer({ id }: MusicPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { asset } = useLocalization()
  const assetHost = asset.host
  const assetScheme = asset.scheme

  useEffect(() => {
    const container = containerRef.current
    if (!container || !id) return
    let cancelled = false
    let destroy: (() => void) | undefined

    void (async () => {
      const [{ default: APlayer }, meta] = await Promise.all([
        import('aplayer-ts'),
        loadMusic(id, { assetHost, assetScheme }),
        import('@/assets/styles/vendor/aplayer.css'),
      ])
      if (cancelled || meta === null) return

      const player = APlayer().init({
        container,
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

      destroy = () => {
        try {
          player.destroy()
          container.innerHTML = ''
        } catch {
          // Nothing actionable: we're already tearing down.
        }
      }
    })()

    return () => {
      cancelled = true
      destroy?.()
    }
  }, [id, assetHost, assetScheme])

  return <div ref={containerRef} className="music-player aplayer" data-id={id} />
}

export interface UnstyledMusicPlayerProps {
  id: string
}

export async function UnstyledMusicPlayer({ id }: UnstyledMusicPlayerProps) {
  // SSR-only path. Reach for the asset host through the shared snapshot
  // because this is async-rendered straight from MDX and has no React
  // context to read from.
  const bundle = requireBlogSettingsBundle()
  if (bundle.localization === null) return null
  const { asset } = bundle.localization
  const meta = await loadMusic(id, {
    assetHost: asset.host,
    assetScheme: asset.scheme,
  })
  const url = meta === null ? '' : meta.url
  if (url === '') return null
  // oxlint-disable-next-line jsx-a11y/media-has-caption -- These MDX audio embeds do not have transcript metadata.
  return <audio controls src={url} aria-label={id} />
}
