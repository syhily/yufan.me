import type { AdminComment } from './types'

// Build a single comment card via DOM APIs. We avoid string templates because
// every field below originates from user input. The only exception is
// `comment.content`, which has already been server-side rendered to safe HTML
// by the markdown pipeline.

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k === 'style') node.setAttribute('style', v)
    else if (k.startsWith('data-') || k === 'href' || k === 'target' || k === 'rel') node.setAttribute(k, v)
    else node.setAttribute(k, v)
  }
  for (const child of children) {
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

function buildAvatar(comment: AdminComment): HTMLElement {
  const wrapper = el('div', { class: 'flex-shrink-0' }, [
    el(
      'div',
      {
        class: 'flex-avatar',
        style:
          "width: 50px; height: 50px; background-size: cover; background-position: center; background-image: url('/images/default-avatar.png');",
      },
      [
        el('img', {
          src: `/images/avatar/${comment.userId}.png`,
          alt: comment.name,
          onerror: "this.style.display='none'",
          style: 'width: 100%; height: 100%; border-radius: 50px; object-fit: cover;',
        }),
      ],
    ),
  ])
  return wrapper
}

function buildHeaderInfo(comment: AdminComment): HTMLElement {
  const titleRow = el('div', { class: 'd-flex align-items-center gap-2 mb-1' }, [el('strong', {}, [comment.name])])

  if (comment.link) {
    const a = el('a', {
      href: comment.link,
      target: '_blank',
      rel: 'nofollow',
      class: 'text-muted small',
    })
    a.appendChild(el('i', { class: 'iconfont icon-link' }))
    titleRow.appendChild(a)
  }

  if (comment.badgeName) {
    const badge = el(
      'span',
      {
        class: 'badge badge-pill fw-bold text-wrap',
        style: `background-color: ${comment.badgeColor || '#008c95'}`,
      },
      [comment.badgeName],
    )
    titleRow.appendChild(badge)
  }

  const statusBadge = comment.isPending
    ? el('span', { class: 'badge badge-warning' }, ['待审核'])
    : el('span', { class: 'badge badge-light' }, ['已审核'])
  titleRow.appendChild(statusBadge)

  const meta = el('div', { class: 'text-muted small' }, [
    el('span', {}, [comment.email]),
    el('span', { class: 'ms-2' }, [formatDate(comment.createAt)]),
  ])

  const wrapper = el('div')
  wrapper.appendChild(titleRow)
  wrapper.appendChild(meta)
  if (comment.pageTitle) {
    wrapper.appendChild(
      el('div', { class: 'text-muted small' }, [el('span', { class: 'mt-2' }, [`来自: ${comment.pageTitle}`])]),
    )
  }
  return wrapper
}

function buildActions(comment: AdminComment): HTMLElement {
  const actions = el('div', { class: 'd-flex flex-wrap gap-2' })

  const editBtn = el('button', { class: 'btn btn-sm btn-primary edit-comment-btn', 'data-comment-id': comment.id })
  editBtn.appendChild(el('i', { class: 'iconfont icon-edit' }))
  editBtn.appendChild(document.createTextNode(' 编辑'))
  actions.appendChild(editBtn)

  const userBtn = el('button', {
    class: 'btn btn-sm btn-primary edit-user-btn',
    'data-user-id': comment.userId,
    'data-user-name': comment.name,
    'data-user-email': comment.email,
    'data-user-link': comment.link || '',
    'data-badge-name': comment.badgeName || '',
    'data-badge-color': comment.badgeColor || '',
  })
  userBtn.appendChild(el('i', { class: 'iconfont icon-user' }))
  userBtn.appendChild(document.createTextNode(' 用户'))
  actions.appendChild(userBtn)

  if (comment.isPending) {
    const approveBtn = el('button', {
      class: 'btn btn-sm btn-outline-success approve-comment-btn',
      'data-comment-id': comment.id,
    })
    approveBtn.appendChild(el('i', { class: 'iconfont icon-check' }))
    approveBtn.appendChild(document.createTextNode(' 审核'))
    actions.appendChild(approveBtn)
  }

  const replyBtn = el('button', {
    class: 'btn btn-sm btn-primary reply-comment-btn',
    'data-comment-id': comment.id,
    'data-page-key': comment.pageKey,
  })
  replyBtn.appendChild(el('i', { class: 'iconfont icon-reply' }))
  replyBtn.appendChild(document.createTextNode(' 回复'))
  actions.appendChild(replyBtn)

  const deleteBtn = el('button', {
    class: 'btn btn-sm btn-outline-danger delete-comment-btn',
    'data-comment-id': comment.id,
  })
  deleteBtn.appendChild(el('i', { class: 'iconfont icon-delete' }))
  deleteBtn.appendChild(document.createTextNode(' 删除'))
  actions.appendChild(deleteBtn)

  return actions
}

function buildFooter(comment: AdminComment): HTMLElement | null {
  if (!comment.ua && !comment.ip) return null
  const wrapper = el('div', { class: 'text-muted small' })
  if (comment.ua) {
    const truncated = comment.ua.length > 50 ? `${comment.ua.substring(0, 50)}...` : comment.ua
    wrapper.appendChild(el('span', {}, [`UA: ${truncated}`]))
  }
  if (comment.ip) {
    wrapper.appendChild(el('span', { class: 'ms-2' }, [`IP: ${comment.ip}`]))
  }
  return wrapper
}

export function renderCommentCard(comment: AdminComment): HTMLElement {
  const card = el('div', { class: 'card mb-3 comment-item', 'data-comment-id': comment.id })
  const cardBody = el('div', { class: 'card-body' })
  const flexWrapper = el('div', { class: 'd-flex gap-3' })
  const right = el('div', { class: 'flex-grow-1' })

  const headerRow = el('div', {
    class: 'd-flex flex-column flex-md-row justify-content-between align-items-start mb-2 gap-2',
  })
  headerRow.appendChild(buildHeaderInfo(comment))
  headerRow.appendChild(buildActions(comment))

  // comment.content is server-rendered HTML; safe to insert via innerHTML.
  const contentDiv = el('div', { class: 'comment-content mb-2', style: 'line-height: 1.6;' })
  contentDiv.innerHTML = comment.content

  right.appendChild(headerRow)
  right.appendChild(contentDiv)

  const footer = buildFooter(comment)
  if (footer) right.appendChild(footer)

  flexWrapper.appendChild(buildAvatar(comment))
  flexWrapper.appendChild(right)
  cardBody.appendChild(flexWrapper)
  card.appendChild(cardBody)

  return card
}

export function renderCommentsList(container: HTMLElement, comments: AdminComment[]): void {
  container.replaceChildren()
  if (comments.length === 0) {
    const empty = el('div', { class: 'card' }, [
      el('div', { class: 'card-body text-center py-5' }, [el('p', { class: 'text-muted mb-0' }, ['暂无评论'])]),
    ])
    container.appendChild(empty)
    return
  }

  const fragment = document.createDocumentFragment()
  for (const comment of comments) {
    fragment.appendChild(renderCommentCard(comment))
  }
  container.appendChild(fragment)
}
