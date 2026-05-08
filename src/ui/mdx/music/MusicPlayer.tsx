import { useEffect, useRef } from 'react'

import { loadMusic } from '@/client/music'
import { requireBlogSettingsBundle } from '@/shared/blog-config'
import { useAssetsSettings } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'

export interface MusicPlayerProps {
  id: string
  auto?: boolean
  center?: boolean
}

const MUSIC_PLAYER_IDLE_TIMEOUT_MS = 2_000

export interface MusicPlayerInitHost {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  cancelIdleCallback?: (handle: number) => void
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
  setTimeout: (callback: () => void, timeout?: number) => number
  clearTimeout: (handle: number) => void
}

function getMusicPlayerInitHost(): MusicPlayerInitHost | undefined {
  return typeof window === 'undefined' ? undefined : window
}

export function scheduleMusicPlayerInit(
  task: () => void,
  host: MusicPlayerInitHost | undefined = getMusicPlayerInitHost(),
): () => void {
  if (host === undefined) {
    return () => undefined
  }

  let cancelled = false
  const run = () => {
    if (cancelled) {
      return
    }
    cancelled = true
    task()
  }

  if (host.requestIdleCallback !== undefined) {
    const id = host.requestIdleCallback(run, { timeout: MUSIC_PLAYER_IDLE_TIMEOUT_MS })
    return () => {
      cancelled = true
      host.cancelIdleCallback?.(id)
    }
  }

  if (host.requestAnimationFrame !== undefined) {
    let timeoutId: number | undefined
    const frameId = host.requestAnimationFrame(() => {
      if (cancelled) {
        return
      }
      timeoutId = host.setTimeout(run, 0)
    })
    return () => {
      cancelled = true
      host.cancelAnimationFrame?.(frameId)
      if (timeoutId !== undefined) {
        host.clearTimeout(timeoutId)
      }
    }
  }

  const timeoutId = host.setTimeout(run, 0)
  return () => {
    cancelled = true
    host.clearTimeout(timeoutId)
  }
}

// MDX-embeddable music player. Lazy-loads APlayer only when the component
// is actually mounted, so posts without music carry no aplayer.js payload.
//
// Reads the assets section from `<BlogSettingsProvider>`. Live SSR / client
// renders inherit the provider from `root.tsx`; the RSS / Atom prerender
// in `@/server/feed` wraps its `prerenderToHtml` call in the same provider
// so this hook can stay strict (no shared-snapshot fallback, no extra
// import boundary).
export function MusicPlayer({ id, auto, center }: MusicPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { asset } = useAssetsSettings()
  const assetHost = asset.host
  const assetScheme = asset.scheme

  useEffect(() => {
    const container = containerRef.current
    if (!container || !id || assetHost === '') {
      return
    }
    let cancelled = false
    let destroy: (() => void) | undefined

    const cancelInit = scheduleMusicPlayerInit(() => {
      if (cancelled) {
        return
      }

      void (async () => {
        const [{ default: APlayer }, meta] = await Promise.all([
          import('aplayer-ts'),
          loadMusic(id, { assetHost, assetScheme }),
          import('aplayer-ts/src/css/base.css'),
        ])
        if (cancelled || meta === null) {
          return
        }

        const player = APlayer().init({
          container,
          lrcType: 1,
          loop: 'none',
          autoplay: auto ?? false,
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
    })

    return () => {
      cancelled = true
      cancelInit()
      destroy?.()
    }
  }, [id, assetHost, assetScheme, auto])

  return (
    <div
      className={cn(
        'mt-5 mb-5.5 max-w-87.5 max-xl:mx-auto max-md:mx-0 max-md:mt-0 max-md:mb-5 max-md:max-w-full',
        center && 'mx-auto max-md:mx-auto',
      )}
    >
      <div ref={containerRef} className="aplayer" data-id={id} />
    </div>
  )
}

export interface UnstyledMusicPlayerProps {
  id: string
}

export async function UnstyledMusicPlayer({ id }: UnstyledMusicPlayerProps) {
  // SSR-only path. Reach for the asset host through the shared snapshot
  // because this is async-rendered straight from MDX and has no React
  // context to read from.
  const bundle = requireBlogSettingsBundle()
  if (bundle.assets === null) {
    return null
  }
  const { asset } = bundle.assets
  const meta = await loadMusic(id, {
    assetHost: asset.host,
    assetScheme: asset.scheme,
  })
  const url = meta === null ? '' : meta.url
  if (url === '') {
    return null
  }
  // oxlint-disable-next-line jsx-a11y/media-has-caption -- These MDX audio embeds do not have transcript metadata.
  return <audio controls src={url} aria-label={id} />
}
