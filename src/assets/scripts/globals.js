/* eslint-disable no-new */
import { actions } from 'astro:actions'
import PhotoSwipe from 'photoswipe'
import PhotoSwipeDynamicCaption from 'photoswipe-dynamic-caption-plugin'
import PhotoSwipeVideo from 'photoswipe-video-plugin'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import { handleActionError } from '@/assets/scripts/actions'
import PhotoSwipeSlideshow from '@/assets/scripts/photoswipe-slideshow.js'
import stickySidebar from '@/assets/scripts/sticky-sidebar.js'

// Slideshow for Album.
for (const album of document.querySelectorAll('.post-content .album')) {
  // Set up the main gallery lightbox.
  const lightbox = new PhotoSwipeLightbox({
    gallery: album,
    pswpModule: PhotoSwipe,
    children: 'a',
    showHideAnimationType: 'zoom',
    zoomAnimationDuration: 400,
    bgOpacity: 1,
  })

  // Add the dynamic description.
  new PhotoSwipeDynamicCaption(lightbox, {
    captionContent: '.pswp-caption-content',
  })

  // Add a slideshow to the PhotoSwipe gallery.
  new PhotoSwipeSlideshow(lightbox, {
    defaultDelayMs: 7000,
    restartOnSlideChange: true,
    progressBarPosition: 'top',
    autoHideProgressBar: false,
  })

  // Plugin to display video.
  new PhotoSwipeVideo(lightbox, {})

  lightbox.init()
}

// Lightbox support for post images.
const imageLinks = Array.from(document.querySelectorAll('.post-content a')).filter((link) => {
  if (link.classList.contains('album-picture')) {
    return false
  }
  const img = link.querySelector('img')
  return typeof img !== 'undefined' && img !== null
})

if (imageLinks.length > 0) {
  // Append the required data attributes.
  for (const imageLink of imageLinks) {
    const image = imageLink.querySelector('img')
    if (image.getAttribute('width') !== null) {
      imageLink.dataset.pswpWidth = image.getAttribute('width')
    }
    if (image.getAttribute('height') !== null) {
      imageLink.dataset.pswpHeight = image.getAttribute('height')
    }
  }

  const lightbox = new PhotoSwipeLightbox({
    gallery: imageLinks,
    showHideAnimationType: 'zoom',
    showAnimationDuration: 300,
    hideAnimationDuration: 300,
    pswpModule: () => PhotoSwipe,
  })
  new PhotoSwipeDynamicCaption(lightbox, {
    captionContent: slide => slide.data.alt,
  })

  lightbox.init()
}

// Menu toggle.
const menuBody = document.querySelector('.site-aside')
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    menuBody.classList.toggle('in', false)
  }
})
document.querySelector('.menu-toggler').addEventListener('click', () => menuBody.classList.toggle('in', true))
document.querySelector('.site-menu').addEventListener('click', () => menuBody.classList.toggle('in', false))
document.querySelector('.aside-overlay').addEventListener('click', () => menuBody.classList.toggle('in', false))

// Go to top.
const goTop = document.querySelector('.fixed-gotop')
function handleScrollUp() {
  window.requestAnimationFrame(() => {
    goTop.classList.toggle('current', window.scrollY > 300)
  })
}

goTop.addEventListener('click', () => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' }))
window.addEventListener('scroll', handleScrollUp)
window.addEventListener('resize', handleScrollUp)

// Dialog popup.
for (const dialog of document.querySelectorAll('.nice-dialog')) {
  const popup = dialog.querySelector('.nice-popup')
  dialog.addEventListener('click', (event) => {
    event.stopPropagation()
    popup.classList.toggle('nice-popup-open', true)
  })

  const close = dialog.querySelector('.nice-popup-close')
  close.addEventListener('click', (event) => {
    event.stopPropagation()
    popup.classList.toggle('nice-popup-open', false)
  })
}

// Search Bar.
const searchSidebar = document.querySelector('.search-sidebar')
if (typeof searchSidebar !== 'undefined' && searchSidebar !== null) {
  searchSidebar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()

      const query = event.target.value
      event.target.value = ''
      location.href = `/search/${encodeURIComponent(query)}`
    }
  })
}

// Search dialog.
const searchPopup = document.querySelector('.global-search-popup')
document.querySelector('.global-search').addEventListener('click', (event) => {
  event.stopPropagation()
  searchPopup.classList.toggle('nice-popup-open', true)
})

document.querySelector('.global-search-close').addEventListener('click', (event) => {
  event.stopPropagation()
  searchPopup.classList.toggle('nice-popup-open', false)
})

searchPopup.querySelector('.search-dialog').addEventListener('submit', (event) => {
  event.preventDefault()
  event.stopPropagation()

  const formData = new FormData(event.target)
  const query = formData.get('q')
  location.href = `/search/${encodeURIComponent(query)}`
})

// Loading the comments.
const comments = document.querySelector('#comments')
if (typeof comments !== 'undefined' && comments !== null) {
  const cancel = comments.querySelector('#cancel-comment-reply-link')
  const replyForm = comments.querySelector('#respond')
  const cancelReply = () => {
    cancel.hidden = true
    replyForm.querySelector('textarea[name="content"]').value = ''

    // Move the form back to top.
    const commentCount = comments.querySelector('.comment-total-count')
    commentCount.after(replyForm)

    // Get rid to clean up the children form.
    const ridInput = replyForm.querySelector('input[name="rid"]')
    const rid = ridInput.value
    ridInput.value = '0'
    if (rid !== '0') {
      const children = comments.querySelector(`#user-comment-${rid}`).querySelector('.children')
      if (children !== null && children.querySelectorAll('li').length === 0) {
        children.remove()
      }
    }
  }

  // TODO: Load the commenter information from the cookie.

  comments.addEventListener('focusout', (event) => {
    const avatar = document.querySelector('#commentForm img.avatar')
    if (event.target === document.querySelector('input[name="email"]')) {
      event.stopPropagation()
      const email = event.target.value
      if (email !== '' && email.includes('@')) {
        // Replace the avatar after typing the email.
        actions.comment.findAvatar({ email }).then(({ data, error }) => {
          if (error) {
            return handleActionError(error)
          }
          avatar.src = data.avatar
        })
      }
      else {
        avatar.src = avatar.dataset.src
      }
    }
  })

  comments.addEventListener('click', async (event) => {
    // Loading more comments from server.
    if (event.target === comments.querySelector('#comments-next-button')) {
      const { size, offset, key } = event.target.dataset
      const { data, error } = await actions.comment.loadComments({ offset: Number(offset), page_key: key })
      if (error) {
        return handleActionError(error)
      }

      const { content, next } = data

      // Remove the load more button.
      if (!next || content === '') {
        event.target.remove()
      }

      // Append the comments into the list.
      if (content !== '') {
        event.target.dataset.offset = Number(offset) + Number(size)
        comments.querySelector('.comment-list').insertAdjacentHTML('beforeend', content)
      }
    }

    // Reply a comment.
    if (event.target.matches('.comment-reply-link')) {
      cancelReply()
      cancel.hidden = false
      replyForm.querySelector('input[name="rid"]').value = event.target.dataset.rid

      // Move form to the reply.
      const commentItem = event.target.closest('li')
      if (commentItem.dataset.depth === '1') {
        if (commentItem.querySelector('ul.children') === null) {
          // Create this for better architecture.
          commentItem.insertAdjacentHTML('beforeend', '<ul class="children"></ul>')
        }
        commentItem.querySelector('ul.children').appendChild(replyForm)
      }
      else {
        commentItem.after(replyForm)
      }

      // Focus the comment form.
      replyForm.querySelector('#content').focus()
    }

    // Cancel reply comment.
    if (event.target === cancel) {
      cancelReply()
    }
  })

  // Reply a comment.
  comments.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopPropagation()

    const formData = new FormData(event.target)
    const request = {}
    for (const [key, value] of formData) {
      request[key] = value
    }
    request.rid = request.rid === undefined ? 0 : Number(request.rid)

    const { data, error } = await actions.comment.replyComment(request)

    if (error) {
      return handleActionError(error)
    }

    const { content } = data
    if (request.rid !== 0) {
      replyForm.insertAdjacentHTML('beforebegin', content)
    }
    else {
      const list = comments.querySelector('.comment-list')
      list.insertAdjacentHTML('afterbegin', content)
    }

    cancelReply()
  })
}

function scrollIntoView(elem) {
  if (elem === undefined || elem === null) {
    return
  }

  const rect = elem.getBoundingClientRect()
  const elemTop = rect.top + window.scrollY
  const scrollOptions = {
    top: elemTop,
    left: 0,
    behavior: 'smooth',
  }

  window.scroll(scrollOptions)
}

// Highlighting the selected comment.
function focusContent() {
  if (location.hash.startsWith('#user-comment-')) {
    for (const li of document.querySelectorAll('.comment-body')) {
      li.classList.remove('active')
    }

    const li = document.querySelector(location.hash)
    if (li !== null) {
      scrollIntoView(li)
      li.querySelector('.comment-body').classList.add('active')
    }
  }
  else {
    // Try to find the ID on heading
    if (location.hash.startsWith('#')) {
      scrollIntoView(document.getElementById(decodeURIComponent(location.hash).substring(1)))
    }
  }
}

window.addEventListener('load', focusContent)

// TOC Support
for (const anchor of document.querySelectorAll('a[href^="#"]')) {
  anchor.addEventListener('click', (e) => {
    e.preventDefault()
    const href = anchor.getAttribute('href')
    location.hash = `${href}`
    scrollIntoView(document.querySelector(anchor.getAttribute('href')))
  })
}

const tocToggle = document.querySelector('.toggle-menu-tree')
if (typeof tocToggle !== 'undefined' && tocToggle !== null) {
  tocToggle.addEventListener('click', () => {
    const body = document.querySelector('body')
    const displayToc = !body.classList.contains('display-menu-tree')
    body.classList.toggle('display-menu-tree', displayToc)
  })
}

// Add like button for updating likes.
const likeButton = document.querySelector('button.post-like')

function increaseLikes(count, permalink) {
  count.textContent = Number.parseInt(count.textContent) + 1
  actions.comment.increaseLike({ key: permalink }).then(({ data, error }) => {
    if (error) {
      return handleActionError(error)
    }
    const { likes, token } = data
    count.textContent = likes
    localStorage.setItem(permalink, token)
  })
}

function decreaseLikes(count, permalink) {
  const token = localStorage.getItem(permalink)
  if (token === null || token === '') {
    return
  }
  count.textContent = Number.parseInt(count.textContent) - 1
  actions.comment.decreaseLike({ key: permalink, token }).then(({ data, error }) => {
    if (error) {
      return handleActionError(error)
    }
    count.textContent = data.likes
    localStorage.removeItem(permalink)
  })
}

if (typeof likeButton !== 'undefined' && likeButton !== null) {
  const permalink = likeButton.dataset.permalink

  // Change the like state if it has been liked.
  const token = localStorage.getItem(permalink)
  if (token !== null && token !== '') {
    likeButton.classList.add('current')
  }

  // Add the click action.
  likeButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()

    const count = likeButton.querySelector('.like-count')
    if (typeof count === 'undefined') {
      return
    }

    // Increase the likes and set liked before submitting.
    if (likeButton.classList.contains('current')) {
      likeButton.classList.remove('current')
      decreaseLikes(count, permalink)
    }
    else {
      likeButton.classList.add('current')
      increaseLikes(count, permalink)
    }
  })
}

// Sticky Sidebar
stickySidebar(document.querySelectorAll('.sidebar'))
