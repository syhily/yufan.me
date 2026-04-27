import { describe, expect, it } from 'vite-plus/test'

import type { CommentItem } from '@/server/comments/types'

import { commentTreeReducer, createCommentTreeState } from '@/ui/comments/Comments'
import { createLikeButtonState, likeButtonReducer } from '@/ui/like/LikeActions'

function makeComment(id: bigint, pageKey: string, name = 'Alice'): CommentItem {
  return {
    id,
    createAt: new Date('2024-01-15T08:30:00.000Z'),
    updatedAt: new Date('2024-01-15T08:30:00.000Z'),
    deleteAt: null,
    content: '<p>Hello.</p>',
    pageKey,
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
    // Optimistic transitions live on `useOptimistic` now; the reducer only
    // handles committed server-truth values. The reset test still has to
    // verify that a stale "first permalink" confirmation cannot leak into a
    // freshly-mounted "second permalink" state.
    let state = createLikeButtonState('/posts/first', 3)
    state = likeButtonReducer(state, { type: 'increaseConfirmed', permalink: '/posts/first', likes: 4 })

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
    const first = makeComment(1n, 'https://yufan.me/posts/first/')
    const second = makeComment(2n, 'https://yufan.me/posts/second/', 'Bob')

    let state = createCommentTreeState([first], 3)
    state = commentTreeReducer(state, { type: 'setReplyTo', rid: 1 })
    state = commentTreeReducer(state, {
      type: 'append',
      items: [makeComment(3n, 'https://yufan.me/posts/first/', 'Carol')],
      rootsLoaded: 2,
    })

    expect(state.replyToId).toBe(1)
    expect(state.roots.map((id) => state.byId.get(id)?.pageKey)).toEqual([
      'https://yufan.me/posts/first/',
      'https://yufan.me/posts/first/',
    ])

    state = commentTreeReducer(state, {
      type: 'reset',
      items: [second],
      rootsTotal: 1,
      rootsLoaded: 1,
    })

    expect(state.replyToId).toBe(0)
    expect(state.rootsLoaded).toBe(1)
    expect(state.rootsTotal).toBe(1)
    expect(state.roots).toEqual(['2'])
    expect(state.byId.get('2')?.pageKey).toBe('https://yufan.me/posts/second/')
    expect(state.byId.get('2')?.name).toBe('Bob')
  })
})
