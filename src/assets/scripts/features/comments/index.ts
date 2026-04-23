import { actions } from 'astro:actions'

import { handleActionError } from '@/assets/scripts/actions'

import { attachReplyOverlay, removeReplyOverlay } from './reply-overlay'

type Nullable<T> = T | null

interface ReplyRequest {
  name: string
  email: string
  page_key: string
  content: string
  link?: string
  rid: number
}

// Try to extract the author name out of `.comment-author` even if it doesn't
// wrap the text in an anchor.
function extractAuthorName(commentItem: HTMLElement): string {
  const authorEl = commentItem.querySelector<HTMLElement>('.comment-author')
  if (!authorEl) return ''
  const anchor = authorEl.querySelector<HTMLAnchorElement>('a')
  if (anchor?.textContent) {
    return anchor.textContent.trim()
  }
  const textNode = Array.from(authorEl.childNodes).find(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim(),
  )
  return textNode?.textContent?.trim() || authorEl.textContent?.trim() || ''
}

function buildReplyRequest(form: HTMLFormElement): ReplyRequest {
  const formData = new FormData(form)
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const page_key = formData.get('page_key') as string
  const content = formData.get('content') as string
  const link = formData.get('link') as string | null
  const rid = formData.get('rid')

  const request: ReplyRequest = { name, email, page_key, content, rid: 0 }
  if (link) request.link = link
  if (rid !== undefined && rid !== null && rid !== '') {
    request.rid = Number(rid)
  }
  return request
}

export function initComments(): void {
  const comments = document.querySelector<HTMLDivElement>('#comments')
  if (!comments) return

  const cancel = comments.querySelector<HTMLInputElement>('#cancel-comment-reply-link')!
  const replyForm = comments.querySelector<HTMLDivElement>('#respond')!

  const cancelReply = (): void => {
    cancel.hidden = true
    const textarea = replyForm.querySelector<HTMLTextAreaElement>('textarea[name="content"]')
    if (textarea) textarea.value = ''

    removeReplyOverlay(replyForm)

    const commentCount = comments.querySelector('.comment-total-count')!
    commentCount.after(replyForm)

    const ridInput = replyForm.querySelector<HTMLInputElement>('input[name="rid"]')!
    const rid = ridInput.value
    ridInput.value = '0'
    if (rid !== '0') {
      const userComment = comments.querySelector(`#user-comment-${rid}`) as Nullable<HTMLLIElement>
      if (userComment) {
        const children = userComment.querySelector('.children') as Nullable<HTMLUListElement>
        if (children !== null && children.querySelectorAll('li').length === 0) {
          children.remove()
        }
      }
    }
  }

  comments.addEventListener('focusout', (event: FocusEvent) => {
    const avatar = document.querySelector<HTMLImageElement>('#commentForm img.avatar')
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]')
    if (event.target !== emailInput || !avatar || !emailInput) return

    event.stopPropagation()
    const email = emailInput.value
    if (email !== '' && email.includes('@')) {
      actions.comment.findAvatar({ email }).then(({ data, error }) => {
        if (error) return handleActionError(error)
        if (data) avatar.src = data.avatar
      })
    } else {
      avatar.src = avatar.dataset.src!
    }
  })

  comments.addEventListener('click', async (event: MouseEvent) => {
    const target = event.target as HTMLElement

    // Load more comments
    const nextButton = comments.querySelector('#comments-next-button')
    if (target === nextButton) {
      await handleLoadMore(target as HTMLButtonElement, comments)
      return
    }

    // Reply link
    if (target.matches('.comment-reply-link')) {
      handleReplyClick(target, replyForm, cancel, cancelReply)
      return
    }

    // Edit a comment (admin)
    if (target.matches('.comment-edit-link')) {
      await handleEditClick(target)
      return
    }

    // Approve
    if (target.matches('.comment-approve-link')) {
      const rid = target.dataset.rid
      if (typeof rid !== 'string') return
      const { error } = await actions.comment.approve({ rid })
      if (error) return handleActionError(error)
      target.remove()
      return
    }

    // Delete
    if (target.matches('.comment-delete-link')) {
      const rid = target.dataset.rid
      if (typeof rid !== 'string') return
      const { error } = await actions.comment.delete({ rid })
      if (error) return handleActionError(error)
      target.closest('li')!.remove()
      return
    }

    // Cancel reply
    if (target === cancel) cancelReply()
  })

  comments.addEventListener('submit', async (event: Event) => {
    event.preventDefault()
    event.stopPropagation()

    const request = buildReplyRequest(event.target as HTMLFormElement)
    const { data, error } = await actions.comment.replyComment(request)
    if (error) return handleActionError(error)

    const { content: replyContent } = data
    if (request.rid !== 0) {
      replyForm.insertAdjacentHTML('beforebegin', replyContent)
    } else {
      const list = comments.querySelector('.comment-list')!
      list.insertAdjacentHTML('afterbegin', replyContent)
    }

    cancelReply()
  })
}

async function handleLoadMore(btn: HTMLButtonElement, comments: HTMLElement): Promise<void> {
  const originalText = btn.textContent || ''
  btn.disabled = true
  btn.textContent = '加载中...'

  const { size, offset, key } = btn.dataset
  if (typeof key !== 'string' || typeof offset !== 'string' || typeof size !== 'string') {
    btn.disabled = false
    btn.textContent = originalText
    return
  }

  try {
    const { data, error } = await actions.comment.loadComments({
      offset: Number(offset),
      page_key: key,
    })
    if (error) {
      btn.disabled = false
      btn.textContent = originalText
      return handleActionError(error)
    }

    const { content, next } = data
    if (content !== '') {
      btn.dataset.offset = String(Number(offset) + Number(size))
      comments.querySelector('.comment-list')!.insertAdjacentHTML('beforeend', content)
    }

    if (!next || content === '') {
      btn.remove()
    } else {
      btn.disabled = false
      btn.textContent = originalText
    }
  } catch (e) {
    btn.disabled = false
    btn.textContent = originalText
    console.error(e)
  }
}

function handleReplyClick(
  target: HTMLElement,
  replyForm: HTMLElement,
  cancel: HTMLInputElement,
  cancelReply: () => void,
): void {
  cancelReply()
  cancel.hidden = false
  ;(replyForm.querySelector('input[name="rid"]') as HTMLInputElement).value = target.dataset.rid!

  const commentItem = target.closest('li') as HTMLLIElement
  if (commentItem.dataset.depth === '1') {
    if (!commentItem.querySelector('ul.children')) {
      commentItem.insertAdjacentHTML('beforeend', '<ul class="children"></ul>')
    }
    commentItem.querySelector('ul.children')!.appendChild(replyForm)
  } else {
    commentItem.after(replyForm)
  }

  const authorName = extractAuthorName(commentItem)
  const contentEl = commentItem.querySelector<HTMLElement>('.comment-content')
  const originalContent = contentEl?.textContent?.trim() || ''
  attachReplyOverlay(replyForm, authorName, originalContent)
  ;(replyForm.querySelector('#content') as HTMLTextAreaElement).focus()
}

async function handleEditClick(target: HTMLElement): Promise<void> {
  const rid = target.dataset.rid
  if (typeof rid !== 'string') return

  const commentItem = target.closest('li') as HTMLLIElement
  const contentEl = commentItem.querySelector<HTMLElement>('.comment-content')
  if (!contentEl) return
  if (commentItem.querySelector('.comment-edit-area')) return

  const { data, error } = await actions.comment.getRaw({ rid })
  if (error) return handleActionError(error)

  const raw = data?.content || ''

  const editWrapper = document.createElement('div')
  editWrapper.className = 'comment-edit-area mt-2'

  const ta = document.createElement('textarea')
  ta.className = 'form-control comment-edit-textarea'
  ta.rows = 4
  ta.value = raw

  const ctrl = document.createElement('div')
  ctrl.className = 'mt-2 text-end'

  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'btn btn-primary me-2 comment-save-edit'
  saveBtn.textContent = '保存'

  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'btn btn-light comment-cancel-edit'
  cancelBtn.textContent = '取消'

  ctrl.appendChild(saveBtn)
  ctrl.appendChild(cancelBtn)
  editWrapper.appendChild(ta)
  editWrapper.appendChild(ctrl)
  contentEl.appendChild(editWrapper)

  cancelBtn.addEventListener('click', () => editWrapper.remove())

  saveBtn.addEventListener('click', async () => {
    const originalText = saveBtn.textContent || '保存'
    saveBtn.disabled = true
    saveBtn.textContent = '保存中...'
    try {
      const { data: editData, error: editError } = await actions.comment.edit({
        rid,
        content: ta.value,
      })
      if (editError) {
        saveBtn.disabled = false
        saveBtn.textContent = originalText
        return handleActionError(editError)
      }
      if (editData?.content) {
        commentItem.insertAdjacentHTML('afterend', editData.content)
        commentItem.remove()
      }
    } catch (e) {
      console.error(e)
      saveBtn.disabled = false
      saveBtn.textContent = originalText
    }
  })
}
