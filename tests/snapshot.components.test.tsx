import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'

import type { ClientPostWithMetadata } from '@/server/catalog'

import { CodeBlock } from '@/ui/mdx/CodeBlock'
import { Pagination } from '@/ui/post/pagination/Pagination'
import { PostListingBody, PostSquare } from '@/ui/post/post/ListingLayout'
import { SearchBar } from '@/ui/search/Search'

import { makePost } from './_helpers/catalog'
import { renderInRouter } from './_helpers/render'

function withMetadata(post: ReturnType<typeof makePost>): ClientPostWithMetadata {
  return { ...post, meta: { likes: 5, views: 42, comments: 3 } }
}

// Snapshot a few high-leverage UI shells. These render pure components
// (no SSR loaders, no DB/Redis) so any DOM/markup drift surfaces as a
// PR diff. Real route snapshots would need to mock the entire catalog +
// session pipeline; we intentionally cover the smallest blast-radius
// pieces here.

describe('snapshot: Pagination', () => {
  it('dense (total = 4) at page 2', () => {
    const html = renderInRouter(<Pagination current={2} total={4} rootPath="/archives" />)
    expect(html).toMatchSnapshot()
  })

  it('windowed (total = 12) near the start', () => {
    const html = renderInRouter(<Pagination current={2} total={12} rootPath="/archives" />)
    expect(html).toMatchSnapshot()
  })

  it('windowed (total = 12) in the middle', () => {
    const html = renderInRouter(<Pagination current={6} total={12} rootPath="/archives" />)
    expect(html).toMatchSnapshot()
  })

  it('windowed (total = 12) near the end', () => {
    const html = renderInRouter(<Pagination current={11} total={12} rootPath="/archives" />)
    expect(html).toMatchSnapshot()
  })

  it('returns nothing when total <= 1', () => {
    const html = renderToStaticMarkup(<Pagination current={1} total={1} rootPath="/archives" />)
    expect(html).toBe('')
  })
})

describe('snapshot: SearchBar widget', () => {
  it('renders the sidebar search input', () => {
    const html = renderInRouter(<SearchBar />)
    expect(html).toMatchSnapshot()
  })
})

describe('snapshot: CodeBlock', () => {
  it('renders a React-owned code header and copy button', () => {
    const html = renderToStaticMarkup(
      <CodeBlock className="shiki language-ts" tabIndex={0}>
        <code className="language-ts">
          <span className="line">
            <span>const answer = 42;</span>
          </span>
        </code>
      </CodeBlock>,
    )
    expect(html).toMatchSnapshot()
  })
})

describe('snapshot: PostListingBody (category/tag/search)', () => {
  it('renders the empty 404 state when no posts', () => {
    const html = renderToStaticMarkup(
      <PostListingBody
        title="标签：rust"
        description="描述"
        resolvedPosts={[]}
        pageNum={1}
        totalPage={0}
        rootPath="/tags/rust"
        alwaysRenderPagination={false}
      />,
    )
    expect(html).toMatchSnapshot()
  })

  it('renders a 2-post page with pagination', () => {
    const posts = [
      withMetadata(
        makePost({
          slug: 'first',
          title: 'First post',
          permalink: '/posts/first',
          date: new Date('2024-01-01T00:00:00.000Z'),
        }),
      ),
      withMetadata(
        makePost({
          slug: 'second',
          title: 'Second post',
          permalink: '/posts/second',
          date: new Date('2024-02-01T00:00:00.000Z'),
        }),
      ),
    ]
    const html = renderInRouter(
      <PostListingBody title="分类：技术" resolvedPosts={posts} pageNum={1} totalPage={3} rootPath="/cats/tech" />,
    )
    expect(html).toMatchSnapshot()
  })
})

describe('snapshot: PostSquare card', () => {
  it('renders the first/large variant', () => {
    const post = withMetadata(
      makePost({
        slug: 'card',
        title: 'Card title',
        permalink: '/posts/card',
        date: new Date('2024-03-01T00:00:00.000Z'),
      }),
    )
    const html = renderInRouter(<PostSquare post={post} first />)
    expect(html).toMatchSnapshot()
  })

  it('renders the small variant', () => {
    const post = withMetadata(
      makePost({
        slug: 'card-2',
        title: 'Card 2',
        permalink: '/posts/card-2',
        date: new Date('2024-03-02T00:00:00.000Z'),
      }),
    )
    const html = renderInRouter(<PostSquare post={post} first={false} />)
    expect(html).toMatchSnapshot()
  })
})
