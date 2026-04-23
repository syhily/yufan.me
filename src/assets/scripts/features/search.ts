import { buildSearchPopup, hidePopup, showPopup } from './popup'

// Sidebar search input: redirect to /search/<q> on Enter.
function initSidebarSearch(): void {
  const searchSidebar = document.querySelector<HTMLInputElement>('.search-sidebar')
  if (!searchSidebar) return

  searchSidebar.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    event.stopPropagation()

    const target = event.target as HTMLInputElement
    const query = target.value
    target.value = ''
    location.href = `/search/${encodeURIComponent(query)}`
  })
}

// Search icon in the header opens a centered popup with a search form.
function initSearchPopup(): void {
  let popup: HTMLElement | null = null

  const open = () => {
    if (!popup) {
      popup = buildSearchPopup()

      popup.querySelector('.global-search-close')?.addEventListener('click', (event) => {
        event.stopPropagation()
        if (popup) {
          hidePopup(popup)
          popup = null
        }
      })

      popup.querySelector<HTMLFormElement>('.search-dialog')?.addEventListener('submit', (event) => {
        event.preventDefault()
        event.stopPropagation()

        const formData = new FormData(event.target as HTMLFormElement)
        const query = formData.get('q')
        if (query) {
          location.href = `/search/${encodeURIComponent(query.toString())}`
        }
      })

      showPopup(popup)
    } else {
      showPopup(popup)
    }
  }

  document.querySelector<HTMLElement>('.global-search')?.addEventListener('click', (event) => {
    event.stopPropagation()
    open()
  })

  document.addEventListener('click', (event) => {
    if (!popup) return
    if (popup.contains(event.target as Node)) return
    if ((event.target as HTMLElement).closest('.global-search')) return
    hidePopup(popup)
    popup = null
  })
}

export function initSearch(): void {
  initSidebarSearch()
  initSearchPopup()
}
