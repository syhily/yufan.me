import { qrcode } from '@lowlighter/qrcode'
import { actions } from 'astro:actions'
import mediumZoom from 'medium-zoom'
import { handleActionError } from '@/assets/scripts/actions'
import { TheiaStickySidebar } from '@/assets/scripts/theia-sticky-sidebar'

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

// Medium zoom for images.
const zoom = mediumZoom()
document.addEventListener('DOMContentLoaded', () => {
  zoom.attach('.post-content img', '.post-content svg')
})
document.body.addEventListener('DOMNodeInserted', (event) => {
  zoom.attach(event.target)
})

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

// Render QRCode.
for (const qr of document.querySelectorAll('.qrcode')) {
  const svg = qrcode(qr.dataset.content, { output: 'svg' })
  qr.insertAdjacentHTML('beforeend', svg)
}

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
// stickySidebar(document.querySelectorAll('.sidebar'))

document.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-new
  new TheiaStickySidebar({
    elements: '.sidebar',
    additionalMarginTop: 30,
  })
})
