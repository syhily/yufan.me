import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ClientPostWithMetadata } from '@/server/catalog'

import { HomeLayoutBody } from '@/ui/post/post/HomeLayoutBody'

import { makePost, makePostList, makeTag } from './_helpers/catalog'
import { renderInRouter } from './_helpers/render'

function withMetadata(post: ReturnType<typeof makePost>): ClientPostWithMetadata {
  return { ...post, meta: { likes: 5, views: 42, comments: 3 } }
}

describe('snapshot: HomeLayoutBody composed page', () => {
  // Pin a deterministic clock so the TodayCalendar widget produces a stable
  // `images/calendar/YYYY/MMDD.png` URL across CI runs. 12:00 UTC on
  // 2026-04-25 maps to 20:00 in `Asia/Shanghai`, which the blog config uses
  // for date formatting — locking the rendered date to `0425`.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-25T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the page-1 home composition (feature posts visible)', () => {
    const resolvedPosts = makePostList(3, { slug: 'home' }).map(withMetadata)
    const featurePosts = makePostList(2, { slug: 'feature' })
    const sidebar = {
      posts: makePostList(2, { slug: 'side' }),
      tags: [makeTag({ name: 'typescript', slug: 'typescript' })],
      recentComments: [],
      pendingComments: [],
    }
    const html = renderInRouter(
      <HomeLayoutBody
        resolvedPosts={resolvedPosts}
        pageNum={1}
        totalPage={3}
        categoryLinks={{ general: '/categories/general' }}
        featurePosts={featurePosts}
        admin={false}
        sidebar={sidebar}
      />,
    )
    expect(html).toMatchSnapshot()
  })

  it('renders the deep-paginated home composition (no feature block)', () => {
    const resolvedPosts = makePostList(2, { slug: 'home-page2' }).map(withMetadata)
    const sidebar = {
      posts: [],
      tags: [],
      recentComments: [],
      pendingComments: [],
    }
    const html = renderInRouter(
      <HomeLayoutBody
        resolvedPosts={resolvedPosts}
        pageNum={2}
        totalPage={3}
        categoryLinks={{ general: '/categories/general' }}
        featurePosts={[]}
        admin={false}
        sidebar={sidebar}
      />,
    )
    expect(html).toMatchSnapshot()
  })
})
