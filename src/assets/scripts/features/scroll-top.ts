// Scroll-to-top button. Activates after the viewport leaves the top fold.

export function initScrollTop(): void {
  const goTop = document.querySelector<HTMLElement>('.fixed-gotop')
  if (goTop === null) return

  const onScroll = () => {
    window.requestAnimationFrame(() => {
      goTop.classList.toggle('current', window.scrollY > 300)
    })
  }

  goTop.addEventListener('click', () => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' }))
  window.addEventListener('scroll', onScroll)
  window.addEventListener('resize', onScroll)
}
