import { useEffect } from 'react'
import { useLocation } from 'react-router'

// Smooth-scroll to the URL hash on initial mount and whenever the hash
// changes. Also highlights a comment node when the hash targets one
// (`#user-comment-<id>`).
//
// Previously implemented as a vanilla `window.load` listener in
// `features/focus-hash.ts`. Moving it into a React hook means we get
// both the first-paint behaviour AND client-side navigations for free.
export function useFocusHash(): void {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    // Defer one frame so newly rendered content (e.g. MDX body or a
    // freshly-inserted comment) has time to commit to the DOM before we
    // try to scroll to it.
    const raf = window.requestAnimationFrame(() => {
      if (hash.startsWith('#user-comment-')) {
        for (const li of document.querySelectorAll<HTMLElement>('.comment-body')) {
          li.classList.remove('active')
        }
        const li = document.querySelector<HTMLElement>(hash)
        if (li) {
          smoothScrollTo(li)
          li.querySelector<HTMLElement>('.comment-body')?.classList.add('active')
        }
        return
      }
      const id = decodeURIComponent(hash).substring(1)
      smoothScrollTo(document.getElementById(id))
    })
    return () => window.cancelAnimationFrame(raf)
  }, [hash])
}

function smoothScrollTo(elem: HTMLElement | null): void {
  if (!elem) return
  const rect = elem.getBoundingClientRect()
  const top = rect.top + window.scrollY
  window.scroll({ top, left: 0, behavior: 'smooth' })
}
