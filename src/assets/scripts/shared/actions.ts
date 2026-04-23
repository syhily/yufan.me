import { isInputError } from 'astro:actions'

import { buildToastPopup, hidePopup } from '@/assets/scripts/features/popup'

// Manually display an error dialog.
export function showErrorDialog(errorMsg: string, closeAction?: () => void): void {
  const popup = buildToastPopup(errorMsg, 'error')
  document.body.appendChild(popup)
  popup.querySelector<HTMLElement>('.nice-popup-close')?.addEventListener('click', () => {
    hidePopup(popup)
    closeAction?.()
  })
}

// Display a transient success toast (auto-dismiss).
export function showSuccessDialog(message: string, durationMs = 800): void {
  const popup = buildToastPopup(message, 'success')
  document.body.appendChild(popup)
  setTimeout(() => hidePopup(popup), durationMs)
}

// Popup an error dialog for notifying user the root cause.
export function handleActionError(
  error: { message: string; issues?: { message: string }[] },
  closeAction?: () => void,
): void {
  const errorMsg = isInputError(error)
    ? error.issues!.map((issue) => `<p>${issue.message}</p>`).join('\n')
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
