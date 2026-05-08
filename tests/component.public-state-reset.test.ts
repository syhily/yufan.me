import { describe, expect, it } from 'vite-plus/test'

import type { CommentItem } from '@/shared/comments'

import { commentTreeReducer, createCommentTreeState } from '@/ui/comments/Comments'
import { createLikeButtonState, likeButtonReducer } from '@/ui/like/LikeActions'

function makeComment(id: bigint, ownerId: bigint, name = 'Alice'): CommentItem {
  return {
    id,
    createAt: new Date('2024-01-15T08:30:00.000Z'),
    updatedAt: new Date('2024-01-15T08:30:00.000Z'),
    deleteAt: null,
    content: null,
    body: [{ _type: 'block', _key: 'b1', style: 'normal', children: [{ _type: 'span', _key: 's1', text: 'Hello.' }] }],
    type: 'post',
    ownerId,
    userId: 42n,
    isVerified: true,
    ua: '',
    ip: '',
    rid: 0,
    isCollapsed: false,
    isPending: false,
    isPinned: false,
    voteUp: 0,
    voteDown: 0,
    rootId: 0n,
    name,
    email: `${name.toLowerCase()}@example.com`,
    emailVerified: true,
    link: '',
    badgeName: null,
    badgeColor: null,
    badgeTextColor: null,
    children: [],
  }
}

describe('public detail island state reset', () => {
  it('resets like state when React Router reuses the detail route for another permalink', () => {
    let state = createLikeButtonState('/posts/first', 3)
    state = likeButtonReducer(state, { type: 'increaseOptimistic', permalink: '/posts/first' })

    expect(state).toMatchObject({ permalink: '/posts/first', likes: 4, liked: true })

    state = likeButtonReducer(state, { type: 'reset', permalink: '/posts/second', likes: 1 })
    expect(state).toEqual({ permalink: '/posts/second', likes: 1, liked: false })

    state = likeButtonReducer(state, {
      type: 'increaseConfirmed',
      permalink: '/posts/first',
      likes: 5,
    })
    expect(state).toEqual({ permalink: '/posts/second', likes: 1, liked: false })
  })

  it('resets the comment tree and clears active replies for another comment key', () => {
    const first = makeComment(1n, 1n)
    const second = makeComment(2n, 2n, 'Bob')

    let state = createCommentTreeState([first], 3)
    state = commentTreeReducer(state, { type: 'setReplyTo', rid: 1 })
    state = commentTreeReducer(state, {
      type: 'append',
      items: [makeComment(3n, 1n, 'Carol')],
      rootsLoaded: 2,
    })

    expect(state.replyToId).toBe(1)
    expect(state.items.map((item) => item.ownerId)).toEqual([1n, 1n])

    state = commentTreeReducer(state, {
      type: 'reset',
      items: [second],
      rootsTotal: 1,
      rootsLoaded: 1,
    })

    expect(state.replyToId).toBe(0)
    expect(state.rootsLoaded).toBe(1)
    expect(state.rootsTotal).toBe(1)
    expect(state.items).toEqual([second])
  })
})
