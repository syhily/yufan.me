import type { StructuredData } from 'fumadocs-core/mdx-plugins'

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Post } from '@/server/catalog'

import { makePost } from './_helpers/catalog'

const mocks = vi.hoisted(() => ({
  contentCatalogGet: vi.fn(),
}))

vi.mock('@/server/catalog', () => ({
  ContentCatalog: {
    get: mocks.contentCatalogGet,
  },
}))

const { resetSearchIndexForTest, searchPostOptions, searchPosts } = await import('@/server/search')

// Build a Post-shaped record by reusing the shared ClientPost helper and
// attaching the search-only fields (`structuredData`, body) the new
// fumadocs-flexsearch indexer reads.
function makeIndexablePost(overrides: Partial<Post> & { structuredData?: StructuredData } = {}): Post {
  const { body: _body, structuredData, mdxPath: _mdxPath, ...client } = overrides
  return {
    ...makePost(client),
    body: (() => null) as unknown as Post['body'],
    structuredData: structuredData ?? { headings: [], contents: [] },
    mdxPath: overrides.mdxPath ?? `${client.slug ?? 'test'}.mdx`,
  }
}

beforeEach(() => {
  mocks.contentCatalogGet.mockReset()
  resetSearchIndexForTest()
})

describe('services/search — searchPosts', () => {
  it('builds the index from the same hidden-inclusive options used by the route', async () => {
    const getPosts = vi.fn(() => [
      makeIndexablePost({
        slug: 'visible-react',
        title: 'Visible React',
        tags: ['react'],
      }),
    ])
    mocks.contentCatalogGet.mockResolvedValue({ getPosts })

    await searchPosts('React', 10)

    expect(getPosts).toHaveBeenCalledWith(searchPostOptions())
    expect(searchPostOptions()).toEqual({
      includeHidden: true,
      includeScheduled: import.meta.env.DEV,
    })
  })

  it('paginates over hidden posts returned by the catalog query', async () => {
    const getPosts = vi.fn(() => [
      makeIndexablePost({ slug: 'visible-react', title: 'Visible React', tags: ['react'] }),
      makeIndexablePost({
        slug: 'hidden-react',
        title: 'Hidden React',
        tags: ['react'],
        visible: false,
      }),
      makeIndexablePost({ slug: 'other-topic', title: 'Other Topic', tags: ['misc'] }),
    ])
    mocks.contentCatalogGet.mockResolvedValue({ getPosts })

    const result = await searchPosts('React', 10)

    expect(result.hits).toEqual(expect.arrayContaining(['visible-react', 'hidden-react']))
    expect(result.hits).not.toContain('other-topic')
    expect(result.hits).toHaveLength(2)
    expect(result.totalPages).toBe(1)
  })

  it('matches CJK queries as a phrase against structuredData paragraph content', async () => {
    const getPosts = vi.fn(() => [
      makeIndexablePost({
        slug: 'post-with-phrase',
        title: '标题甲',
        summary: '',
        structuredData: {
          headings: [{ id: 'section-1', content: '第一节' }],
          contents: [{ heading: 'section-1', content: '这里讨论了向量数据库的实现细节' }],
        },
      }),
      // A post that only contains the individual characters of the query
      // scattered across the body must NOT match — the query string is treated
      // as one phrase, not tokenized per character.
      makeIndexablePost({
        slug: 'post-with-scattered-chars',
        title: '标题乙',
        summary: '',
        structuredData: {
          headings: [],
          contents: [
            { heading: undefined, content: '我们用向日葵装饰会场，并测量了灯光的数值据点' },
            { heading: undefined, content: '图书馆藏书丰富。' },
          ],
        },
      }),
    ])
    mocks.contentCatalogGet.mockResolvedValue({ getPosts })

    const result = await searchPosts('向量数据库', 10)

    expect(result.hits).toEqual(['post-with-phrase'])
  })
})
