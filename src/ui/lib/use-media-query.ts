import { useEffect, useState } from 'react'

/**
 * Reactive `window.matchMedia` boolean. The initial value is decided
 * synchronously on the first render — `window.matchMedia(query).matches`
 * on the client, `defaultMatch` on the server — so post-hydration
 * effects never need to flip the value (which would cause a flash and,
 * for portal-based components like Base UI Dialog, leave stale overlay
 * markup attached to the DOM).
 *
 * Hydration mismatch trade-off: the SSR render uses `defaultMatch` so
 * an SSR pass on a small viewport produces the same HTML as the
 * desktop. React 19 will re-render the affected subtree on the client
 * when the lazy initial value disagrees. That re-render is cheaper
 * than the open/close animation glitch the old `useEffect`-based
 * pattern produced — Base UI Dialog's `Backdrop` portal was
 * occasionally getting stuck attached when its `open` prop flipped
 * `false → true → false` inside a single commit batch, leaving an
 * invisible scrim covering the whole viewport and swallowing every
 * click underneath.
 */
export function useMediaQuery(query: string, defaultMatch = false): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return defaultMatch
    }
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    const mql = window.matchMedia(query)
    // Re-sync in case the resolved match changed between the lazy
    // initial read and the effect (rare — but possible if `query`
    // changed across renders).
    setMatches(mql.matches)
    const update = (event: MediaQueryListEvent) => setMatches(event.matches)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])
  return matches
}
