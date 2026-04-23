import { scrollIntoView } from '@/assets/scripts/shared/actions'

// Smooth-scroll for in-page anchor links and toggle for the menu tree.
export function initTableOfContents(): void {
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    anchor.addEventListener('click', (e) => {
      e.preventDefault()
      const href = anchor.getAttribute('href')
      if (href) {
        location.hash = href
        scrollIntoView(document.querySelector<HTMLElement>(href))
      }
    })
  }

  const tocToggle = document.querySelector<HTMLElement>('.toggle-menu-tree')
  if (!tocToggle) return

  tocToggle.addEventListener('click', () => {
    const body = document.querySelector<HTMLElement>('body')
    if (body) {
      const displayToc = !body.classList.contains('display-menu-tree')
      body.classList.toggle('display-menu-tree', displayToc)
    }
  })
}
