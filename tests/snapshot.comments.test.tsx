import { beforeAll, describe, expect, it } from 'vite-plus/test'

import type { CommentItem as CommentItemType } from '@/server/comments/types'

import { compileMarkdown } from '@/server/markdown/runtime'
import { Comment } from '@/ui/comments/Comment'
import { CommentItem } from '@/ui/comments/CommentItem'

import { renderInRouter } from './_helpers/render'

// Pre-compile the two comment bodies used across this file. The runtime
// MDX compiler is async, but the snapshot tests want a synchronous
// `renderInRouter` call. Warming the cache in `beforeAll` lets each
// fixture grab its `bodyCompiled` synchronously through a closure.
let helloBody: string
let replyBody: string

beforeAll(async () => {
  const [hello, reply] = await Promise.all([
    compileMarkdown('Hello, world.', { profile: 'comment' }),
    compileMarkdown('Reply.', { profile: 'comment' }),
  ])
  helloBody = hello?.compiled ?? ''
  replyBody = reply?.compiled ?? ''
}, 60_000)

function makeComment(overrides: Partial<CommentItemType> = {}): CommentItemType {
  return {
    id: 1n,
    createAt: new Date('2024-01-15T08:30:00.000Z'),
    updatedAt: new Date('2024-01-15T08:30:00.000Z'),
    deleteAt: null,
    content: 'Hello, world.',
    pageKey: '/posts/hello',
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
    bodyCompiled: helloBody,
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
    // Inline style writes the per-author palette to CSS custom
    // properties; the surface picks them up through Tailwind utilities
    // like `bg-[color:var(--badge-color)]`. The fallback hex now lives
    // in `globals.css` rather than in the component file, so the
    // assertions check the variable names rather than literal hex.
    expect(html).toContain('--badge-color:#6ab7ca')
    expect(html).toContain('--badge-fg:#151b2b')
    expect(html).toContain('rounded-full font-bold')
    expect(html).toMatchSnapshot()
  })

  it('root comment with one nested child, admin viewer (edit/delete buttons)', () => {
    const child = makeComment({
      id: 2n,
      rid: 1,
      rootId: 1n,
      name: 'Bob',
      link: null,
      content: 'Reply.',
      bodyCompiled: replyBody,
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
