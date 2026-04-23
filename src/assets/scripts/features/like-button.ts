import { actions } from 'astro:actions'

import { handleActionError } from '@/assets/scripts/shared/actions'

async function increaseLikes(count: HTMLElement, permalink: string): Promise<void> {
  count.textContent = (Number.parseInt(count.textContent || '0') + 1).toString()
  const result = await actions.comment.increaseLike({ key: permalink })
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
}

async function decreaseLikes(count: HTMLElement, permalink: string): Promise<void> {
  const token = localStorage.getItem(permalink)
  if (token === null || token === '') return

  count.textContent = (Number.parseInt(count.textContent || '0') - 1).toString()
  const result = await actions.comment.decreaseLike({ key: permalink, token })
  if (result.error) {
    return handleActionError({
      message: result.error.message || 'Failed to decrease likes',
    })
  }
  if (result.data) {
    count.textContent = result.data.likes.toString()
    localStorage.removeItem(permalink)
  }
}

export async function initLikeButton(): Promise<void> {
  const likeButton = document.querySelector<HTMLButtonElement>('button.post-like')
  if (!likeButton) return

  const permalink = likeButton.dataset.permalink
  if (!permalink) return

  // Validate any cached token on page load so the button reflects truth.
  const token = localStorage.getItem(permalink)
  if (token !== null && token !== '') {
    const result = await actions.comment.validateLikeToken({ key: permalink, token })
    if (result.data && result.data.valid) {
      likeButton.classList.add('current')
    } else {
      localStorage.removeItem(permalink)
      likeButton.classList.remove('current')
    }
  }

  likeButton.addEventListener('click', async (event) => {
    event.preventDefault()
    event.stopPropagation()

    const count = likeButton.querySelector<HTMLElement>('.like-count')
    if (!count) return

    if (likeButton.classList.contains('lock')) return

    try {
      likeButton.classList.add('lock')
      if (likeButton.classList.contains('current')) {
        likeButton.classList.remove('current')
        await decreaseLikes(count, permalink)
      } else {
        likeButton.classList.add('current')
        await increaseLikes(count, permalink)
      }
    } finally {
      likeButton.classList.remove('lock')
    }
  })
}
