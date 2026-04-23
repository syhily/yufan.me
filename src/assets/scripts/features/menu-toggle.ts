// Mobile slide-out menu. ESC closes it, the toggler opens, the menu/overlay closes.
export function initMenuToggle(): void {
  const menuBody = document.querySelector<HTMLElement>('.site-aside')

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && menuBody) {
      event.preventDefault()
      event.stopPropagation()
      menuBody.classList.toggle('in', false)
    }
  })

  document
    .querySelector<HTMLElement>('.menu-toggler')
    ?.addEventListener('click', () => menuBody?.classList.toggle('in', true))
  document
    .querySelector<HTMLElement>('.site-menu')
    ?.addEventListener('click', () => menuBody?.classList.toggle('in', false))
  document
    .querySelector<HTMLElement>('.aside-overlay')
    ?.addEventListener('click', () => menuBody?.classList.toggle('in', false))
}
