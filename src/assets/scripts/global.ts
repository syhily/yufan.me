import APlayer from 'aplayer-ts'
import { actions } from 'astro:actions'
import mediumZoom from 'medium-zoom/dist/pure'
import tippy from 'tippy.js'
import { handleActionError, scrollIntoView } from '@/assets/scripts/actions'
import { qrcode } from '@/assets/scripts/qrcode'
import { stickySidebar } from '@/assets/scripts/sidebar'
import { attachCopyButtons } from '@/assets/scripts/snippet'
import { loadMusic } from '@/components/mdx/music/loader'

// Type helpers
type Nullable<T> = T | null

// Highlighting the selected comment.
function focusContent(): void {
  if (location.hash.startsWith('#user-comment-')) {
    for (const li of document.querySelectorAll<HTMLElement>('.comment-body')) {
      li.classList.remove('active')
    }

    const li = document.querySelector<HTMLElement>(location.hash)
    if (li) {
      scrollIntoView(li)
      li.querySelector<HTMLElement>('.comment-body')?.classList.add('active')
    }
  }
  else {
    // Try to find the ID on heading
    if (location.hash.startsWith('#')) {
      const id = decodeURIComponent(location.hash).substring(1)
      scrollIntoView(document.getElementById(id))
    }
  }
}
window.addEventListener('load', focusContent)

// Go to top.
const goTop = document.querySelector<HTMLElement>('.fixed-gotop')
if (goTop !== null) {
  function handleScrollUp(): void {
    window.requestAnimationFrame(() => {
      goTop?.classList.toggle('current', window.scrollY > 300)
    })
  }
  goTop.addEventListener('click', () => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' }))
  window.addEventListener('scroll', handleScrollUp)
  window.addEventListener('resize', handleScrollUp)
}

// Medium zoom for images.
const zoom = mediumZoom()
zoom.attach('.post-content img', '.post-content svg')

// Code copy button.
attachCopyButtons()

// Footnotes.
document.querySelectorAll('sup a[id^="user-content-fnref-"]')
  .forEach((link) => {
    const href = link.getAttribute('href')
    const footnote = document.querySelector(`${href} p`)
    if (footnote) {
      tippy(link, {
        content: footnote.innerHTML,
        allowHTML: true,
        theme: 'light',
        placement: 'top',
        animation: 'fade',
      })
    }
  })

// Create popup template based on props
function createPopupTemplate(title: string, name: string, qrcode: string) {
  return `
  <div class="nice-popup nice-popup-center nice-popup-sm">
    <div class="nice-popup-overlay"></div>
    <div class="nice-popup-body">
      <div class="nice-popup-close">
        <span class="svg-white"></span>
      </div>
      <div class="nice-popup-content">
        <div class="text-center">
          <h6>${title}</h6>
          <p class="mt-1 mb-2">${name}</p>
          <div class="qrcode d-flex justify-content-center align-items-center p-2">${qrcode}</div>
        </div>
      </div>
    </div>
  </div>
`.trim()
}

// Handle each dialog instance
document.querySelectorAll<HTMLElement>('.nice-dialog').forEach((dialog) => {
  let popup: HTMLElement | null = null

  const hidePopup = () => {
    popup?.classList.remove('nice-popup-open')
    setTimeout(() => {
      if (popup && !popup.classList.contains('nice-popup-open')) {
        popup.remove()
        popup = null
      }
    }, 300)
  }

  const showPopup = () => {
    if (!popup) {
      // Create popup if it doesn't exist
      const { title, name, url } = dialog.dataset
      if (!title || !name || !url) {
        return
      }

      // Render QRCode
      const svg = qrcode(url, { border: 2 })

      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = createPopupTemplate(title, name, svg)
      popup = tempDiv.firstElementChild as HTMLElement
      document.body.appendChild(popup)

      // Attach close handler
      popup.querySelector('.nice-popup-close')?.addEventListener('click', (event) => {
        event.stopPropagation()
        hidePopup()
      })
    }

    requestAnimationFrame(() => {
      popup?.classList.add('nice-popup-open')
    })
  }
  // Show popup on click
  dialog.addEventListener('click', (event) => {
    event.stopPropagation()
    showPopup()
  })

  // Close popup when clicking outside
  document.addEventListener('click', (event) => {
    if (
      popup
      && !popup.contains(event.target as Node)
      && !dialog.contains(event.target as Node)
    ) {
      hidePopup()
    }
  })
})

// TOC Support
for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
  anchor.addEventListener('click', (e) => {
    e.preventDefault()
    const href = anchor.getAttribute('href')
    if (href) {
      location.hash = href
      scrollIntoView(document.querySelector<HTMLElement>(href))
    }
  })
}

const tocToggle = document.querySelector<HTMLElement>('.toggle-menu-tree')
if (tocToggle) {
  tocToggle.addEventListener('click', () => {
    const body = document.querySelector<HTMLElement>('body')
    if (body) {
      const displayToc = !body.classList.contains('display-menu-tree')
      body.classList.toggle('display-menu-tree', displayToc)
    }
  })
}

// Sticky Sidebar
stickySidebar({
  elements: '.sidebar',
  additionalMarginTop: 30,
})

// Sidebar Tooltips
tippy('.sidebar .widget-title', {
  theme: 'light',
  placement: 'left',
  animation: 'fade',
})

// Menu toggle.
const menuBody = document.querySelector<HTMLElement>('.site-aside')
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && menuBody) {
    event.preventDefault()
    event.stopPropagation()
    menuBody.classList.toggle('in', false)
  }
})
document.querySelector<HTMLElement>('.menu-toggler')?.addEventListener('click', () => menuBody?.classList.toggle('in', true))
document.querySelector<HTMLElement>('.site-menu')?.addEventListener('click', () => menuBody?.classList.toggle('in', false))
document.querySelector<HTMLElement>('.aside-overlay')?.addEventListener('click', () => menuBody?.classList.toggle('in', false))

// Search Bar.
const searchSidebar = document.querySelector<HTMLInputElement>('.search-sidebar')
if (searchSidebar) {
  searchSidebar.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()

      const target = event.target as HTMLInputElement
      const query = target.value
      target.value = ''
      location.href = `/search/${encodeURIComponent(query)}`
    }
  })
}

// Search Dialog
const searchPopupTemplate = `
<div class="global-search-popup nice-popup nice-popup-center nice-popup-md">
  <div class="nice-popup-overlay"></div>
  <div class="nice-popup-body">
    <div class="global-search-close nice-popup-close">
      <span class="svg-white"></span>
    </div>
    <div class="nice-popup-content">
      <form class="search-dialog text-center p-3 p-md-5" action="/search">
        <div class="mb-3 mb-md-4">
          <input
            class="form-control form-control-lg text-center"
            type="text"
            name="q"
            placeholder="搜索并回车"
            required
          />
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">搜索</button>
      </form>
    </div>
  </div>
</div>`.trim()

// Handle search functionality with view transitions support
let searchPopup: HTMLElement | null = null

function hideSearchPopup() {
  searchPopup?.classList.remove('nice-popup-open')
  setTimeout(() => {
    if (searchPopup && !searchPopup.classList.contains('nice-popup-open')) {
      searchPopup.remove()
      searchPopup = null
    }
  }, 300)
}

function showSearchPopup() {
  // Create popup if it doesn't exist
  if (!searchPopup) {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = searchPopupTemplate
    searchPopup = tempDiv.firstElementChild as HTMLElement
    document.body.appendChild(searchPopup)

    // Attach close handler
    searchPopup.querySelector('.global-search-close')?.addEventListener('click', (event) => {
      event.stopPropagation()
      hideSearchPopup()
    })

    // Attach form submit handler
    searchPopup.querySelector<HTMLFormElement>('.search-dialog')?.addEventListener('submit', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const formData = new FormData(event.target as HTMLFormElement)
      const query = formData.get('q')
      if (query) {
        location.href = `/search/${encodeURIComponent(query.toString())}`
      }
    })
  }

  // Show the popup
  requestAnimationFrame(() => {
    searchPopup?.classList.add('nice-popup-open')
  })
}

// Attach click handler to search icon
document.querySelector<HTMLElement>('.global-search')?.addEventListener('click', (event) => {
  event.stopPropagation()
  showSearchPopup()
})

// Close popup when clicking outside
document.addEventListener('click', (event) => {
  if (
    searchPopup
    && !searchPopup.contains(event.target as Node)
    && !(event.target as HTMLElement).closest('.global-search')
  ) {
    hideSearchPopup()
  }
})

// Loading the comments.
const comments = document.querySelector<HTMLDivElement>('#comments')
if (typeof comments !== 'undefined' && comments !== null) {
  const cancel = comments.querySelector<HTMLInputElement>('#cancel-comment-reply-link')!
  const replyForm = comments.querySelector<HTMLDivElement>('#respond')!
  const cancelReply = (): void => {
    cancel.hidden = true;
    (replyForm.querySelector('textarea[name="content"]') as HTMLTextAreaElement).value = ''

    // Remove the readonly replying-to prefix or overlay if present and restore padding
    const replyingTo = replyForm.querySelector('.replying-to, .replying-to-overlay')
    if (replyingTo) {
      // If it's an overlay, restore textarea padding and remove event listeners
      if (replyingTo.classList.contains('replying-to-overlay')) {
        const formText = replyForm.querySelector<HTMLDivElement>('.comment-form-text')!
        const textarea = formText.querySelector<HTMLTextAreaElement>('textarea[name="content"]')!
        const orig = textarea.dataset._origPaddingTop || ''
        textarea.style.paddingTop = orig
        delete textarea.dataset._origPaddingTop

        // Remove attached handlers
        const onFocus = (textarea as any).__replyOverlayFocus
        const onBlur = (textarea as any).__replyOverlayBlur
        if (onFocus)
          textarea.removeEventListener('focus', onFocus)
        if (onBlur)
          textarea.removeEventListener('blur', onBlur)
        delete (textarea as any).__replyOverlayFocus
        delete (textarea as any).__replyOverlayBlur
      }
      replyingTo.remove()
    }

    // Move the form back to top.
    const commentCount = comments.querySelector('.comment-total-count')!
    commentCount.after(replyForm)

    // Get rid to clean up the children form.
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
    if (event.target === emailInput && avatar && emailInput) {
      event.stopPropagation()
      const email = emailInput.value
      if (email !== '' && email.includes('@')) {
        // Replace the avatar after typing the email.
        actions.comment.findAvatar({ email }).then(({ data, error }: any) => {
          if (error) {
            return handleActionError(error)
          }
          avatar.src = data.avatar
        })
      }
      else {
        avatar.src = avatar.dataset.src!
      }
    }
  })

  comments.addEventListener('click', async (event: MouseEvent) => {
    const target = event.target as HTMLElement
    // Loading more comments from server.
    const nextButton = comments.querySelector('#comments-next-button')
    if (target === nextButton) {
      const btn = target as HTMLButtonElement
      // Disable button immediately to prevent duplicate triggers and show loading state.
      const originalText = btn.textContent || ''
      btn.disabled = true
      btn.textContent = '加载中...'

      const { size, offset, key } = btn.dataset
      if (typeof key === 'string' && typeof offset === 'string' && typeof size === 'string') {
        try {
          const { data, error } = await actions.comment.loadComments({ offset: Number(offset), page_key: key })
          if (error) {
            // Restore button state on error before delegating to the handler.
            btn.disabled = false
            btn.textContent = originalText
            return handleActionError(error)
          }

          const { content, next } = data

          // Append the comments into the list.
          if (content !== '') {
            btn.dataset.offset = String(Number(offset) + Number(size))
            comments.querySelector('.comment-list')!.insertAdjacentHTML('beforeend', content)
          }

          // Remove the load more button if no further pages, otherwise restore it.
          if (!next || content === '') {
            btn.remove()
          }
          else {
            btn.disabled = false
            btn.textContent = originalText
          }
        }
        catch (e) {
          // Network or unexpected error: restore button and rethrow/log.
          btn.disabled = false
          btn.textContent = originalText
          console.error(e)
        }
      }
      else {
        // If dataset is malformed, restore button state.
        btn.disabled = false
        btn.textContent = originalText
      }
    }

    // Reply a comment.
    if (target.matches('.comment-reply-link')) {
      cancelReply()
      cancel.hidden = false;
      (replyForm.querySelector('input[name="rid"]') as HTMLInputElement).value = (target as HTMLElement).dataset.rid!

      // Move form to the reply.
      const commentItem = target.closest('li') as HTMLLIElement
      if (commentItem.dataset.depth === '1') {
        if (commentItem.querySelector('ul.children') === null) {
          // Create this for better architecture.
          commentItem.insertAdjacentHTML('beforeend', '<ul class="children"></ul>')
        }
        commentItem.querySelector('ul.children')!.appendChild(replyForm)
      }
      else {
        commentItem.after(replyForm)
      }

      // Extract the author name and content from the comment
      let authorName = ''
      let originalContent = ''
      const authorEl = commentItem.querySelector('.comment-author') as HTMLElement | null
      const contentEl = commentItem.querySelector('.comment-content') as HTMLElement | null

      if (authorEl) {
        const anchor = authorEl.querySelector('a') as HTMLAnchorElement | null
        if (anchor && anchor.textContent) {
          authorName = anchor.textContent.trim()
        }
        else {
          const textNode = Array.from(authorEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim())
          authorName = (textNode && textNode.textContent) ? textNode.textContent.trim() : (authorEl.textContent || '').trim()
        }
      }

      if (contentEl) {
        originalContent = contentEl.textContent?.trim() || ''
      }

      // Remove any existing prefix/overlay then insert new one
      const existingPrefix = replyForm.querySelector('.replying-to, .replying-to-overlay')
      if (existingPrefix)
        existingPrefix.remove()
      if (authorName) {
        const formText = replyForm.querySelector<HTMLDivElement>('.comment-form-text')!
        const textarea = formText.querySelector<HTMLTextAreaElement>('textarea[name="content"]')!

        // Create an overlay element that floats inside the textarea area.
        const overlay = document.createElement('div')
        overlay.className = 'replying-to-overlay'

        // Create spans for the name and content parts for better styling
        const nameSpan = document.createElement('span')
        nameSpan.className = 'replying-name'
        nameSpan.textContent = `回复 @${authorName}`

        const contentSpan = document.createElement('span')
        contentSpan.className = 'replying-content'
        contentSpan.textContent = originalContent ? `: ${originalContent}` : ''

        overlay.appendChild(nameSpan)
        overlay.appendChild(contentSpan)
        Object.assign(overlay.style, {
          position: 'absolute',
          top: '0.4rem',
          left: '0.75rem',
          right: '0.75rem',
          fontSize: '0.9rem',
          color: 'rgba(73, 80, 87, 0.95)',
          pointerEvents: 'none',
          background: 'rgba(0, 140, 149, 0.05)',
          borderRadius: '4px',
          padding: '0.15rem 0.5rem',
          zIndex: '2',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: '0.6',
          display: 'flex',
          gap: '0.25rem',
          alignItems: 'center',
        })

        // Ensure the container is positioned so the overlay can be absolutely positioned.
        const formTextEl = formText as HTMLElement
        if (!formTextEl.style.position)
          formTextEl.style.position = 'relative'

        // Remember original textarea paddingTop for later restore.
        const prevPaddingTop = textarea.style.paddingTop || window.getComputedStyle(textarea).paddingTop || ''
        textarea.dataset._origPaddingTop = prevPaddingTop

        // Append overlay first so we can measure its height and set a padding gap
        formText.appendChild(overlay)

        // Compute overlay height and add a small gap so the caret doesn't collide with overlay.
        // Use getBoundingClientRect with fallback to offsetHeight.
        const overlayRect = overlay.getBoundingClientRect()
        const overlayHeight = (overlayRect && overlayRect.height) ? overlayRect.height : (overlay.offsetHeight || 0)
        const gap = 10 // px gap between overlay bottom and caret
        textarea.style.paddingTop = `${overlayHeight + gap}px`
      }

      // Focus the comment form.
      (replyForm.querySelector('#content') as HTMLTextAreaElement).focus()
    }

    // Edit a comment (admin only visible button)
    if (target.matches('.comment-edit-link')) {
      const rid = (target as HTMLElement).dataset.rid
      if (typeof rid === 'string') {
        const commentItem = target.closest('li') as HTMLLIElement
        const contentEl = commentItem.querySelector('.comment-content') as HTMLElement | null
        if (!contentEl)
          return

        // Prevent duplicate editors
        if (commentItem.querySelector('.comment-edit-area'))
          return

        // Fetch raw content from server (admin only action)
        const { data, error } = await actions.comment.getRaw({ rid })
        if (error) {
          return handleActionError(error)
        }

        const raw = (data && data.content) ? data.content : ''

        // Build editor UI
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

        // Cancel handler
        cancelBtn.addEventListener('click', () => {
          editWrapper.remove()
        })

        // Save handler
        saveBtn.addEventListener('click', async () => {
          const originalText = saveBtn.textContent || '保存'
          saveBtn.disabled = true
          saveBtn.textContent = '保存中...'
          try {
            const { data: editData, error: editError } = await actions.comment.edit({ rid, content: ta.value })
            if (editError) {
              saveBtn.disabled = false
              saveBtn.textContent = originalText
              return handleActionError(editError)
            }

            if (editData && editData.content) {
              // Replace the whole comment item with updated HTML
              commentItem.insertAdjacentHTML('afterend', editData.content)
              commentItem.remove()
            }
          }
          catch (e) {
            console.error(e)
            saveBtn.disabled = false
            saveBtn.textContent = originalText
          }
        })
      }
    }

    // Approve a comment.
    if (target.matches('.comment-approve-link')) {
      const rid = (target as HTMLElement).dataset.rid
      if (typeof rid === 'string') {
        const { error } = await actions.comment.approve({ rid })
        if (error) {
          return handleActionError(error)
        }
        else {
          target.remove()
        }
      }
    }

    // Delete a comment.
    if (target.matches('.comment-delete-link')) {
      const rid = (target as HTMLElement).dataset.rid
      if (typeof rid === 'string') {
        const { error } = await actions.comment.delete({ rid })
        if (error) {
          return handleActionError(error)
        }
        else {
          target.closest('li')!.remove()
        }
      }
    }

    // Cancel reply comment.
    if (target === cancel) {
      cancelReply()
    }
  })

  // Reply a comment.
  comments.addEventListener('submit', async (event: Event) => {
    event.preventDefault()
    event.stopPropagation()

    const form = event.target as HTMLFormElement
    const formData = new FormData(form)
    // Build the request object with explicit types
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const page_key = formData.get('page_key') as string
    const content = formData.get('content') as string
    const link = formData.get('link') as string | null
    const rid = formData.get('rid')
    const request: {
      name: string
      email: string
      page_key: string
      content: string
      link?: string
      rid?: number
    } = {
      name,
      email,
      page_key,
      content,
    }
    if (link)
      request.link = link
    if (rid !== undefined && rid !== null && rid !== '') {
      request.rid = Number(rid)
    }
    else {
      request.rid = 0
    }

    const { data, error } = await actions.comment.replyComment(request)

    if (error) {
      return handleActionError(error)
    }

    const { content: replyContent } = data
    if (request.rid !== 0) {
      replyForm.insertAdjacentHTML('beforebegin', replyContent)
    }
    else {
      const list = comments.querySelector('.comment-list')!
      list.insertAdjacentHTML('afterbegin', replyContent)
    }

    cancelReply()
  })
}

// Aplayer
for (const p of document.querySelectorAll<HTMLTableElement>(`.aplayer`)) {
  if (p.dataset.id === undefined) {
    continue
  }
  const meta = await loadMusic(p.dataset.id)
  if (meta === null) {
    continue
  }
  APlayer().init({
    container: p,
    lrcType: 1,
    loop: 'none',
    audio: {
      name: meta.name,
      artist: meta.artist,
      url: meta.url,
      cover: meta.pic,
      theme: '#008c95',
      lrc: meta.lyric,
    },
  })
}

// Add like button for updating likes.
async function increaseLikes(count: HTMLElement, permalink: string): Promise<void> {
  count.textContent = (Number.parseInt(count.textContent || '0') + 1).toString()
  await actions.comment.increaseLike({ key: permalink }).then((result) => {
    if (result.error) {
      return handleActionError({
        message: result.error.message || 'Failed to increase likes',
      })
    }
    if (result.data) {
      const { likes, token } = result.data
      count.textContent = likes.toString()
      localStorage.setItem(permalink, token)
    }
  })
}

async function decreaseLikes(count: HTMLElement, permalink: string): Promise<void> {
  const token = localStorage.getItem(permalink)
  if (token === null || token === '') {
    return
  }
  count.textContent = (Number.parseInt(count.textContent || '0') - 1).toString()
  await actions.comment.decreaseLike({ key: permalink, token }).then((result) => {
    if (result.error) {
      return handleActionError({
        message: result.error.message || 'Failed to decrease likes',
      })
    }
    if (result.data) {
      count.textContent = result.data.likes.toString()
      localStorage.removeItem(permalink)
    }
  })
}

const likeButton = document.querySelector<HTMLButtonElement>('button.post-like')
if (likeButton) {
  const permalink = likeButton.dataset.permalink
  if (permalink) {
    // Check if token exists in localStorage and validate it on page load
    const token = localStorage.getItem(permalink)
    if (token !== null && token !== '') {
      // Validate token with backend
      await actions.comment.validateLikeToken({ key: permalink, token }).then((result) => {
        if (result.data && result.data.valid) {
          // Token is valid, set the liked state
          likeButton.classList.add('current')
        }
        else {
          // Token is invalid or validation failed, clear it
          localStorage.removeItem(permalink)
          likeButton.classList.remove('current')
        }
      })
    }

    // Add the click action.
    likeButton.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()

      const count = likeButton.querySelector<HTMLElement>('.like-count')
      if (!count) {
        return
      }

      // Disable the changing.
      if (likeButton.classList.contains('lock')) {
        return
      }

      // Increase the likes and set liked before submitting.
      try {
        likeButton.classList.add('lock')
        if (likeButton.classList.contains('current')) {
          likeButton.classList.remove('current')
          await decreaseLikes(count, permalink)
        }
        else {
          likeButton.classList.add('current')
          await increaseLikes(count, permalink)
        }
      }
      finally {
        likeButton.classList.remove('lock')
      }
    })
  }
}
