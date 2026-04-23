// Renders the admin pagination UI matching the look of `Pagination.astro`.
// Uses DOM APIs only and binds click handlers via the provided callback.

import ellipsisIcon from '@/assets/icons/svg/ellipsis.svg?raw'

interface RenderArgs {
  totalComments: number
  currentPage: number // 0-based
  pageSize: number
  onChange: (page: number) => void
}

function makeAnchor(label: string | number, page: number, onChange: (p: number) => void): HTMLAnchorElement {
  const a = document.createElement('a')
  a.className = 'page-numbers'
  a.href = '#'
  a.dataset.page = String(page)
  a.textContent = String(label)
  a.addEventListener('click', (e) => {
    e.preventDefault()
    onChange(page)
  })
  return a
}

function makeCurrent(label: number): HTMLSpanElement {
  const span = document.createElement('span')
  span.setAttribute('aria-current', 'page')
  span.className = 'page-numbers current'
  span.textContent = String(label)
  return span
}

function makeDots(): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = 'page-numbers dots'
  const icon = document.createElement('span')
  icon.className = 'icon icon-ellipsis'
  icon.setAttribute('aria-hidden', 'true')
  icon.innerHTML = ellipsisIcon
  span.appendChild(icon)
  return span
}

export function renderPagination(container: HTMLElement, args: RenderArgs): void {
  const { totalComments, currentPage, pageSize, onChange } = args
  container.replaceChildren()

  const totalPages = Math.ceil(totalComments / pageSize)
  if (totalPages <= 1) return

  const currentPageNum = currentPage + 1
  const navLinks = document.createElement('div')
  navLinks.className = 'nav-links'

  const append = (node: Node) => navLinks.appendChild(node)

  if (totalPages <= 6) {
    for (let i = 1; i <= totalPages; i++) {
      append(i === currentPageNum ? makeCurrent(i) : makeAnchor(i, i - 1, onChange))
    }
  } else {
    const pages =
      currentPageNum < 5
        ? [1, 2, 3, 4, 5]
        : currentPageNum > totalPages - 4
          ? [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
          : [currentPageNum - 1, currentPageNum, currentPageNum + 1]

    if (currentPageNum < 5) {
      for (const page of pages)
        append(page === currentPageNum ? makeCurrent(page) : makeAnchor(page, page - 1, onChange))
      append(makeDots())
      append(makeAnchor(totalPages, totalPages - 1, onChange))
    } else if (currentPageNum > totalPages - 4) {
      append(makeAnchor(1, 0, onChange))
      append(makeDots())
      for (const page of pages)
        append(page === currentPageNum ? makeCurrent(page) : makeAnchor(page, page - 1, onChange))
    } else {
      append(makeAnchor(1, 0, onChange))
      append(makeDots())
      for (const page of pages)
        append(page === currentPageNum ? makeCurrent(page) : makeAnchor(page, page - 1, onChange))
      append(makeDots())
      append(makeAnchor(totalPages, totalPages - 1, onChange))
    }
  }

  const nav = document.createElement('nav')
  nav.className = 'navigation pagination'
  nav.setAttribute('aria-label', '评论')

  const heading = document.createElement('h2')
  heading.className = 'screen-reader-text'
  heading.textContent = '评论导航'
  nav.appendChild(heading)
  nav.appendChild(navLinks)

  container.appendChild(nav)
}
