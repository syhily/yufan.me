import { useEffect, useRef } from 'react'

import { loadMusic } from '@/client/music'

export interface MusicPlayerProps {
  id: string
}

// MDX-embeddable music player. Lazy-loads APlayer only when the component
// is actually mounted, so posts without music carry no aplayer.js payload.
export function MusicPlayer({ id }: MusicPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !id) {
      return
    }
    let cancelled = false
    let destroy: (() => void) | undefined

    void (async () => {
      const [{ default: APlayer }, meta] = await Promise.all([
        import('aplayer-ts'),
        loadMusic(id),
        import('aplayer-ts/src/css/base.css'),
      ])
      if (cancelled || meta === null) {
        return
      }

      // APlayer expects a literal CSS colour string and stamps it into
      // inline `style="background:..."` attributes that the project would
      // otherwise have to keep in lock-step with the brand hex. Resolving
      // `--color-accent` from `globals.css` at runtime keeps the player's
      // theme in sync with the design token (light + dark) without baking
      // a brand-hex literal into JSX. The variable is always declared on
      // `:root`, so the lookup never returns an empty string in the
      // browser.
      const themeColor = getComputedStyle(container).getPropertyValue('--color-accent').trim()

      const player = APlayer().init({
        container,
        lrcType: 1,
        loop: 'none',
        audio: {
          name: meta.name,
          artist: meta.artist,
          url: meta.url,
          cover: meta.pic,
          theme: themeColor,
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
  }, [id])

  return (
    <div
      ref={containerRef}
      // The `aplayer` class is also a hook for the dynamically imported
      // `aplayer-ts/src/css/base.css`, which scopes a few internal styles
      // to it. Wrapper sizing/margins live as Tailwind utilities so the
      // only remaining CSS for the player is the third-party stylesheet
      // itself.
      className="aplayer mt-0 mx-8 mb-5 max-w-full md:my-5 md:mx-0 md:max-w-[350px]"
      data-id={id}
    />
  )
}

export interface UnstyledMusicPlayerProps {
  id: string
}

export async function UnstyledMusicPlayer({ id }: UnstyledMusicPlayerProps) {
  const meta = await loadMusic(id)
  const url = meta === null ? '' : meta.url
  if (url === '') {
    return null
  }
  // oxlint-disable-next-line jsx-a11y/media-has-caption -- These MDX audio embeds do not have transcript metadata.
  return <audio controls src={url} aria-label={id} />
}
