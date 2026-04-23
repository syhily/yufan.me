// Builds and tears down the "回复 @author" overlay shown above the textarea
// when a user clicks the "回复" link on an existing comment.

interface OverlayState {
  textarea: HTMLTextAreaElement
  prevPaddingTop: string
}

const STATE = new WeakMap<HTMLElement, OverlayState>()

export function attachReplyOverlay(replyForm: HTMLElement, authorName: string, originalContent: string): void {
  removeReplyOverlay(replyForm)
  if (!authorName) return

  const formText = replyForm.querySelector<HTMLDivElement>('.comment-form-text')
  if (!formText) return
  const textarea = formText.querySelector<HTMLTextAreaElement>('textarea[name="content"]')
  if (!textarea) return

  const overlay = document.createElement('div')
  overlay.className = 'replying-to-overlay'

  const nameSpan = document.createElement('span')
  nameSpan.className = 'replying-name'
  nameSpan.textContent = `回复 @${authorName}`

  const contentSpan = document.createElement('span')
  contentSpan.className = 'replying-content'
  contentSpan.textContent = originalContent ? `: ${originalContent}` : ''

  overlay.appendChild(nameSpan)
  overlay.appendChild(contentSpan)
  formText.appendChild(overlay)

  const prevPaddingTop = textarea.style.paddingTop || window.getComputedStyle(textarea).paddingTop || ''
  STATE.set(replyForm, { textarea, prevPaddingTop })

  // Pad the top of the textarea so the caret doesn't sit underneath the overlay.
  const overlayRect = overlay.getBoundingClientRect()
  const overlayHeight = overlayRect.height || overlay.offsetHeight || 0
  const gap = 10
  textarea.style.paddingTop = `${overlayHeight + gap}px`
}

export function removeReplyOverlay(replyForm: HTMLElement): void {
  const overlay = replyForm.querySelector('.replying-to, .replying-to-overlay')
  if (!overlay) return

  const state = STATE.get(replyForm)
  if (state) {
    state.textarea.style.paddingTop = state.prevPaddingTop
    STATE.delete(replyForm)
  }
  overlay.remove()
}
