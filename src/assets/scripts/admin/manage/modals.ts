import { actions, handleActionError, showErrorDialog, showSuccessDialog } from '@/assets/scripts/shared/actions'

// Open / close handlers for the three admin modals (edit comment, edit user,
// reply). Submission handlers are wired once on init.

export function setupModalClose(): void {
  document.querySelectorAll('.nice-popup-close, .close-modal-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.nice-popup')?.classList.remove('nice-popup-open')
    })
  })

  document.querySelectorAll('.nice-popup-overlay').forEach((overlay) => {
    overlay.addEventListener('click', () => {
      overlay.closest('.nice-popup')?.classList.remove('nice-popup-open')
    })
  })
}

export function bindCommentEvents(reload: () => void): void {
  document.querySelectorAll('.edit-comment-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const commentId = (btn as HTMLElement).dataset.commentId!
      const { data, error } = await actions.comment.getRaw({ rid: commentId })
      if (error) return handleActionError(error)
      ;(document.getElementById('edit-comment-id') as HTMLInputElement).value = commentId
      ;(document.getElementById('edit-comment-content') as HTMLTextAreaElement).value = data?.content || ''
      document.getElementById('edit-comment-modal')!.classList.add('nice-popup-open')
    })
  })

  document.querySelectorAll('.approve-comment-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // eslint-disable-next-line no-alert
      if (!window.confirm('确定要审核通过这条评论吗？')) return
      const commentId = (btn as HTMLElement).dataset.commentId!
      const { error } = await actions.comment.approve({ rid: commentId })
      if (error) return handleActionError(error)
      showSuccessDialog('评论已审核通过')
      reload()
    })
  })

  document.querySelectorAll('.delete-comment-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // eslint-disable-next-line no-alert
      if (!window.confirm('确定要删除这条评论吗？此操作不可恢复！')) return
      const commentId = (btn as HTMLElement).dataset.commentId!
      const { error } = await actions.comment.delete({ rid: commentId })
      if (error) return handleActionError(error)
      showSuccessDialog('评论已删除')
      reload()
    })
  })

  document.querySelectorAll('.edit-user-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ds = (btn as HTMLElement).dataset
      ;(document.getElementById('edit-user-id') as HTMLInputElement).value = ds.userId!
      ;(document.getElementById('edit-user-name') as HTMLInputElement).value = ds.userName!
      ;(document.getElementById('edit-user-email') as HTMLInputElement).value = ds.userEmail!
      ;(document.getElementById('edit-user-link') as HTMLInputElement).value = ds.userLink || ''
      ;(document.getElementById('edit-user-badge-name') as HTMLInputElement).value = ds.badgeName || ''
      ;(document.getElementById('edit-user-badge-color') as HTMLInputElement).value = ds.badgeColor || '#008c95'
      document.getElementById('edit-user-modal')!.classList.add('nice-popup-open')
    })
  })

  document.querySelectorAll('.reply-comment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ds = (btn as HTMLElement).dataset
      ;(document.getElementById('reply-comment-id') as HTMLInputElement).value = ds.commentId!
      ;(document.getElementById('reply-page-key') as HTMLInputElement).value = ds.pageKey!
      ;(document.getElementById('reply-comment-content') as HTMLTextAreaElement).value = ''
      document.getElementById('reply-comment-modal')!.classList.add('nice-popup-open')
    })
  })
}

export function bindModalForms(reload: () => void): void {
  document.getElementById('edit-comment-form')!.addEventListener('submit', async (e) => {
    e.preventDefault()
    const commentId = (document.getElementById('edit-comment-id') as HTMLInputElement).value
    const content = (document.getElementById('edit-comment-content') as HTMLTextAreaElement).value.trim()
    if (!content) return showErrorDialog('评论内容不能为空')

    const { error } = await actions.comment.edit({ rid: commentId, content })
    if (error) return handleActionError(error)

    document.getElementById('edit-comment-modal')!.classList.remove('nice-popup-open')
    showSuccessDialog('评论已更新')
    reload()
  })

  document.getElementById('edit-user-form')!.addEventListener('submit', async (e) => {
    e.preventDefault()
    const userId = (document.getElementById('edit-user-id') as HTMLInputElement).value
    const name = (document.getElementById('edit-user-name') as HTMLInputElement).value
    const email = (document.getElementById('edit-user-email') as HTMLInputElement).value
    const link = (document.getElementById('edit-user-link') as HTMLInputElement).value
    const badgeName = (document.getElementById('edit-user-badge-name') as HTMLInputElement).value
    const badgeColor = (document.getElementById('edit-user-badge-color') as HTMLInputElement).value

    const updateData: {
      userId: string
      name: string
      email: string
      link?: string
      badgeName?: string
      badgeColor?: string
    } = { userId, name, email }
    if (link) updateData.link = link
    if (badgeName) updateData.badgeName = badgeName
    if (badgeColor) updateData.badgeColor = badgeColor

    const { error } = await actions.auth.updateUser(updateData)
    if (error) return handleActionError(error)

    document.getElementById('edit-user-modal')!.classList.remove('nice-popup-open')
    showSuccessDialog('用户信息已更新')
    reload()
  })

  document.getElementById('reply-comment-form')!.addEventListener('submit', async (e) => {
    e.preventDefault()
    const commentId = (document.getElementById('reply-comment-id') as HTMLInputElement).value
    const pageKey = (document.getElementById('reply-page-key') as HTMLInputElement).value
    const content = (document.getElementById('reply-comment-content') as HTMLTextAreaElement).value.trim()
    if (!content) return showErrorDialog('回复内容不能为空')

    const userNameInput = document.getElementById('admin-user-name') as HTMLInputElement
    const userEmailInput = document.getElementById('admin-user-email') as HTMLInputElement
    if (!userNameInput || !userEmailInput) return showErrorDialog('无法获取用户信息，请刷新页面重试')

    const userName = userNameInput.dataset.value || '管理员'
    const userEmail = userEmailInput.dataset.value || ''
    if (!userEmail) return showErrorDialog('无法获取用户邮箱，请刷新页面重试')

    const { error } = await actions.comment.replyComment({
      page_key: pageKey,
      name: userName,
      email: userEmail,
      content,
      rid: Number.parseInt(commentId, 10),
    })
    if (error) return handleActionError(error)

    document.getElementById('reply-comment-modal')!.classList.remove('nice-popup-open')
    showSuccessDialog('回复已发送')
    reload()
  })
}
