import { scrollIntoView } from '@/assets/scripts/shared/actions'

// Highlight the comment or heading targeted by the URL hash on initial load.
export function initFocusHash(): void {
  window.addEventListener('load', () => {
    if (location.hash.startsWith('#user-comment-')) {
      for (const li of document.querySelectorAll<HTMLElement>('.comment-body')) {
        li.classList.remove('active')
      }

      const li = document.querySelector<HTMLElement>(location.hash)
      if (li) {
        scrollIntoView(li)
        li.querySelector<HTMLElement>('.comment-body')?.classList.add('active')
      }
      return
    }

    if (location.hash.startsWith('#')) {
      const id = decodeURIComponent(location.hash).substring(1)
      scrollIntoView(document.getElementById(id))
    }
  })
}
