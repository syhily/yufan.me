import { describe, expect, it } from 'vite-plus/test'

import type { CommentFormUser } from '@/shared/catalog'
import type { CommentItem as CommentItemType } from '@/shared/comments'

import { CommentReplyForm } from '@/ui/comments/CommentReplyForm'
import { Comments } from '@/ui/comments/Comments'

import { renderInRouter } from './_helpers/render'

// `Comments.tsx` was previously a 159-line component that hand-rolled the
// admin-vs-anonymous form three times (name / email / link). After
// extracting `<CommentFormFields>` and porting the reply form to an island,
// we lock the rendered markup so any regression in the read-only-hidden vs.
// visible-required pattern is caught by a snapshot diff.
describe('snapshot: Comments form variants', () => {
  it('renders the anonymous form (visible required name/email, optional link)', () => {
    const html = renderInRouter(
      <Comments
        commentKey="https://yufan.me/posts/hello/"
        csrfToken="snapshot-csrf-token"
        comments={{ comments: [], count: 0, roots_count: 0 }}
        items={[]}
      />,
    )
    expect(html).toMatchSnapshot()
  })

  it('renders the admin form (hidden readonly identity inputs preloaded)', () => {
    const adminUser: CommentFormUser = {
      id: '1',
      name: 'Admin',
      email: 'admin@yufan.me',
      website: 'https://yufan.me',
      admin: true,
    }
    const html = renderInRouter(
      <Comments
        commentKey="https://yufan.me/posts/hello/"
        csrfToken="snapshot-csrf-token"
        comments={{ comments: [], count: 0, roots_count: 0 }}
        items={[]}
        user={adminUser}
      />,
    )
    expect(html).toMatchSnapshot()
  })

  it('returns the failure placeholder when comments is null', () => {
    const html = renderInRouter(
      <Comments
        commentKey="https://yufan.me/posts/hello/"
        csrfToken="snapshot-csrf-token"
        comments={null}
        items={[]}
      />,
    )
    expect(html).toContain('评论加载失败')
  })

  it('offsets the reply textarea below the reply context overlay', () => {
    const replyTarget: CommentItemType = {
      id: 42n,
      createAt: new Date('2024-04-18T13:06:00.000Z'),
      updatedAt: new Date('2024-04-18T13:06:00.000Z'),
      deleteAt: null,
      content: '<p>谢谢告知，目前 RSS 在 Next.js 下面使用起来比较困难。</p>',
      pageKey: '/posts/hello',
      userId: 1n,
      isVerified: true,
      ua: '',
      ip: '',
      rid: 1,
      isCollapsed: false,
      isPending: false,
      isPinned: false,
      voteUp: 0,
      voteDown: 0,
      rootId: 1n,
      name: '雨帆',
      email: 'admin@yufan.me',
      emailVerified: true,
      link: 'https://yufan.me',
      badgeName: '站长',
      badgeColor: '#6ab7ca',
      badgeTextColor: '#151b2b',
      children: [],
    }

    const html = renderInRouter(
      <CommentReplyForm
        commentKey="https://yufan.me/posts/hello/"
        csrfToken="snapshot-csrf-token"
        onCsrfRotated={() => undefined}
        replyToId={42}
        replyTarget={replyTarget}
        onCancel={() => undefined}
        onReplied={() => undefined}
      />,
    )

    // `comment-reply-textarea` is the marker class that flips on extra
    // padding-top to make room for the `<ReplyOverlay>`. The shared
    // `formControlTextareaClass` chain is asserted by the full-
    // snapshot tests above; here we only care that the marker class
    // lands on the textarea.
    expect(html).toMatch(/<textarea[^>]*class="[^"]*comment-reply-textarea\b[^"]*pt-10\b/u)
    // `replying-to-overlay` is now followed by a long utility chain
    // (absolute positioning + brand-tinted bg + ellipsis chrome) that
    // the marker presence rather than pinning the exact ordering.
    expect(html).toMatch(/<div class="replying-to-overlay\b/u)
    expect(html).toContain('回复 @雨帆')
  })
})
