import tippy from 'tippy.js'

// Show footnote previews as tippy tooltips when hovering reference markers.
export function initFootnoteTooltips(): void {
  document.querySelectorAll('sup a[id^="user-content-fnref-"]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href) return
    const footnote = document.querySelector(`${href} p`)
    if (!footnote) return

    tippy(link, {
      content: footnote.innerHTML,
      allowHTML: true,
      theme: 'light',
      placement: 'top',
      animation: 'fade',
    })
  })
}
