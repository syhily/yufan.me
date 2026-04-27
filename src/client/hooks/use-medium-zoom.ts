import { useEffect } from 'react'

// Attach medium-zoom behaviour to images + SVGs inside `.prose-host`.
// Lazy-loads the library so it stays out of the initial bundle; the effect
// no-ops on SSR because `useEffect` does not fire during renderToString.
export function useMediumZoom(): void {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    let cancelled = false
    void (async () => {
      const [{ default: mediumZoom }] = await Promise.all([
        import('medium-zoom/dist/pure'),
        import('medium-zoom/dist/style.css'),
      ])
      if (cancelled) {
        return
      }
      const zoom = mediumZoom()
      zoom.attach('.prose-host img', '.prose-host svg')
      cleanup = () => zoom.detach()
    })()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])
}
