import { describe, expect, it } from 'vite-plus/test'

import type { ClientPostWithMetadata } from '@/server/catalog'

import { PostListingBody } from '@/ui/post/post/ListingLayout'

import { makePost } from './_helpers/catalog'
import { renderInRouter } from './_helpers/render'

function withMetadata(post: ReturnType<typeof makePost>): ClientPostWithMetadata {
  return { ...post, meta: { likes: 0, views: 0, comments: 0 } }
}

describe('snapshot: PostListingBody (category variant)', () => {
  it('renders the category-list page with description + posts', () => {
    const posts = [
      withMetadata(
        makePost({
          slug: 'first',
          title: 'First',
          permalink: '/posts/first',
          date: new Date('2024-01-01T00:00:00.000Z'),
        }),
      ),
      withMetadata(
        makePost({
          slug: 'second',
          title: 'Second',
          permalink: '/posts/second',
          date: new Date('2024-02-01T00:00:00.000Z'),
        }),
      ),
    ]
    const html = renderInRouter(
      <PostListingBody
        title="技术"
        description="Programming, infrastructure, debugging."
        resolvedPosts={posts}
        pageNum={1}
        totalPage={2}
        rootPath="/cats/tech"
      />,
    )
    expect(html).toMatchSnapshot()
  })

  it('renders the deep-paginated category page (no description)', () => {
    const posts = [
      withMetadata(
        makePost({
          slug: 'third',
          title: 'Third',
          permalink: '/posts/third',
          date: new Date('2024-03-01T00:00:00.000Z'),
        }),
      ),
    ]
    const html = renderInRouter(
      <PostListingBody title="技术" resolvedPosts={posts} pageNum={2} totalPage={2} rootPath="/cats/tech" />,
    )
    expect(html).toMatchSnapshot()
  })
})
