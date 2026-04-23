import { buildToastPopup, hidePopup } from '@/assets/scripts/features/popup'

export interface ActionErrorPayload {
  message: string
  issues?: { message: string; path?: string[] }[]
}

export interface ActionResult<T> {
  data?: T
  error?: ActionErrorPayload
}

async function callAction<T>(domain: string, name: string, input: unknown): Promise<ActionResult<T>> {
  const response = await fetch(`/api/actions/${domain}/${name}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(input),
  })

  const result = (await response.json()) as ActionResult<T>
  if (!response.ok && !result.error) {
    return { error: { message: `Request failed with status ${response.status}` } }
  }
  return result
}

export const actions = {
  auth: {
    signIn: (input: { email: string; password: string; token?: string }) =>
      callAction<{ redirectTo: string }>('auth', 'signIn', input),
    signUpAdmin: (input: { name: string; email: string; password: string }) =>
      callAction<{ redirectTo: string }>('auth', 'signUpAdmin', input),
    updateUser: (input: {
      userId: string
      name?: string
      email?: string
      link?: string
      badgeName?: string
      badgeColor?: string
    }) => callAction<{ success: boolean }>('auth', 'updateUser', input),
  },
  comment: {
    increaseLike: (input: { key: string }) =>
      callAction<{ likes: number; token: string }>('comment', 'increaseLike', input),
    decreaseLike: (input: { key: string; token: string }) =>
      callAction<{ likes: number }>('comment', 'decreaseLike', input),
    validateLikeToken: (input: { key: string; token: string }) =>
      callAction<{ valid: boolean }>('comment', 'validateLikeToken', input),
    findAvatar: (input: { email: string }) => callAction<{ avatar: string }>('comment', 'findAvatar', input),
    replyComment: (input: {
      name: string
      email: string
      page_key: string
      content: string
      link?: string
      rid: number
    }) => callAction<{ content: string }>('comment', 'replyComment', input),
    approve: (input: { rid: string }) => callAction<void>('comment', 'approve', input),
    delete: (input: { rid: string }) => callAction<void>('comment', 'delete', input),
    loadComments: (input: { offset: number; page_key: string }) =>
      callAction<{ content: string; next: boolean }>('comment', 'loadComments', input),
    getRaw: (input: { rid: string }) => callAction<{ content: string }>('comment', 'getRaw', input),
    edit: (input: { rid: string; content: string }) => callAction<{ content: string }>('comment', 'edit', input),
    getFilterOptions: (input: Record<string, never>) =>
      callAction<{ pages: { key: string; title: string }[]; authors: { id: string; name: string }[] }>(
        'comment',
        'getFilterOptions',
        input,
      ),
    loadAll: (input: {
      offset: number
      limit: number
      pageKey?: string
      userId?: string
      status?: 'all' | 'pending' | 'approved'
    }) => callAction<{ html: string; total: number; hasMore: boolean }>('comment', 'loadAll', input),
  },
}

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
export function handleActionError(error: ActionErrorPayload, closeAction?: () => void): void {
  const errorMsg =
    error.issues !== undefined ? error.issues!.map((issue) => `<p>${issue.message}</p>`).join('\n') : error.message
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
