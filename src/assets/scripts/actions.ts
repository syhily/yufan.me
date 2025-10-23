import { isInputError } from 'astro:actions'

function errorDialog(errorMsg: string): string {
  return `<div class="nice-popup nice-popup-center sticky-top error nice-popup-error nice-popup-open">
  <div class="nice-popup-overlay"></div>
  <div class="nice-popup-body">
    <div class="nice-popup-close"><span class="svg-white"></span> <span class="svg-dark"></span></div>
    <div class="nice-popup-content">
      <div class="icon"></div>
      <div class="text-center">
        <p class="mt-1 mb-2">${errorMsg}</p>
      </div>
    </div>
  </div>
</div>`
}

// Manually display an error dialog
export function showErrorDialog(errorMsg: string, closeAction?: () => void): void {
  const errorPopup = errorDialog(errorMsg)
  document.querySelector('body')!.insertAdjacentHTML('beforeend', errorPopup)
  const popup = document.querySelector('.nice-popup-error')!
  popup.querySelector('.nice-popup-close')!.addEventListener('click', () => {
    popup.remove()
    if (closeAction) {
      closeAction()
    }
  })
}

// Popup an error dialog for notifying user the root cause.
export function handleActionError(
  error: { message: string, issues?: { message: string }[] },
  closeAction?: () => void,
): void {
  const errorMsg = isInputError(error)
    ? error.issues!.map(issue => `<p>${issue.message}</p>`).join('\n')
    : error.message
  showErrorDialog(errorMsg, closeAction)
}

export function scrollIntoView(elem: HTMLElement | null): void {
  if (!elem) {
    return
  }

  const rect = elem.getBoundingClientRect()
  const elemTop = rect.top + window.scrollY
  const scrollOptions: ScrollToOptions = {
    top: elemTop,
    left: 0,
    behavior: 'smooth',
  }

  window.scroll(scrollOptions)
}
