import { describe, expect, it } from 'vite-plus/test'

import type { CommentItem as CommentItemType } from '@/shared/comments'

import { Comment } from '@/ui/public/comments/Comment'
import { CommentItem } from '@/ui/public/comments/CommentItem'

import { renderInRouter } from './_helpers/render'

function makeComment(overrides: Partial<CommentItemType> = {}): CommentItemType {
  return {
    id: 1n,
    createAt: new Date('2024-01-15T08:30:00.000Z'),
    updatedAt: new Date('2024-01-15T08:30:00.000Z'),
    deleteAt: null,
    content: null,
    body: [
      {
        _type: 'block',
        _key: 'b1',
        style: 'normal',
        children: [{ _type: 'span', _key: 's1', text: 'Hello, world.' }],
      },
    ],
    type: 'post' as const,
    ownerId: 1n,
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
    rootId: null,
    name: 'Alice',
    email: 'alice@example.com',
    emailVerified: true,
    link: 'https://alice.example.com',
    badgeName: null,
    badgeColor: null,
    badgeTextColor: null,
    children: [],
    ...overrides,
  }
}

// Snapshot the comment markup as rendered by the React component tree
// (post P0-4 the API endpoints return JSON `CommentItem` records and the
// browser re-uses these same components, so the SSR shape and the client
// shape are guaranteed to match).
describe('snapshot: comment HTML', () => {
  it('root comment without children, non-admin viewer', () => {
    const html = renderInRouter(<CommentItem comment={makeComment()} depth={1} admin={false} />)
    expect(html).toMatchSnapshot()
  })

  it('renders author badge inline with the comment author', () => {
    const html = renderInRouter(
      <CommentItem
        comment={makeComment({
          badgeName: '站长',
          badgeColor: '#6ab7ca',
          badgeTextColor: '#151b2b',
        })}
        depth={1}
        admin={false}
      />,
    )
    // The badge is still a `<span>` (not a `<div>`) carrying the
    // chip utility chain (`text-badge font-bold rounded-full
    // inline-flex …`). Stage 11 P9 dropped the legacy
    // `comment-author-badge` WP-compat literal, so the matcher keys
    // off the surviving badge-typography tokens instead.
    expect(html).toMatch(/<span class="[^"]*\bleading-badge\b[^"]*\btext-badge\b[^"]*\bfont-bold\b/u)
    expect(html).toContain('color:#151b2b')
    // Defence: the badge label "站长" must sit inside a `<span>`,
    // not a `<div>` (the `<div>` would break the inline flow next to
    // the author link).
    expect(html).not.toMatch(/<div[^>]*\bleading-badge\b/u)
    expect(html).not.toContain('comment-author-badge')
    expect(html).toMatchSnapshot()
  })

  it('root comment with one nested child, admin viewer (edit/delete buttons)', () => {
    const child = makeComment({
      id: 2n,
      rid: 1,
      rootId: 1n,
      name: 'Bob',
      link: null,
      content: '<p>Reply.</p>',
    })
    const root = makeComment({ children: [child] })
    const html = renderInRouter(<CommentItem comment={root} depth={1} admin={true} />)
    expect(html).toMatchSnapshot()
  })

  it('pending comment shows the moderation hint', () => {
    const html = renderInRouter(
      <CommentItem comment={makeComment({ isPending: true })} depth={1} admin={false} pending />,
    )
    expect(html).toMatchSnapshot()
  })

  it('rendered list of two siblings', () => {
    const html = renderInRouter(
      <Comment comments={[makeComment({ id: 1n }), makeComment({ id: 2n, name: 'Bob' })]} admin={false} />,
    )
    expect(html).toMatchSnapshot()
  })

  // The previous SSR-string path stripped React event props before injecting
  // the markup, so we used a CSS background-image fallback for the avatar
  // instead of an `onError` handler. We keep that contract here so an
  // accidental `onError` (or worse, an inline `onerror=`) doesn't sneak back
  // into the markup.
  it('does not emit any inline onerror= attributes on rendered comment HTML', () => {
    const html = renderInRouter(<CommentItem comment={makeComment()} depth={1} admin={true} />)
    expect(html.toLowerCase()).not.toContain('onerror')
  })
})
