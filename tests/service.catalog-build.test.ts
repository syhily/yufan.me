import { createElement, Fragment } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// Drive `ContentCatalog.build` end-to-end with synthetic Fumadocs collections,
// asserting the post / page / category / tag / alias / image-hydration
// invariants that downstream loaders rely on. We mock `#source/server` so we
// don't need the real MDX compile pipeline.

vi.mock('#source/server', () => {
  const tomorrow = new Date(Date.now() + 86_400_000)
  return {
    posts: [
      {
        slug: 'hello',
        title: 'Hello',
        date: new Date('2024-01-01T00:00:00.000Z'),
        updated: new Date('2024-01-01T00:00:00.000Z'),
        category: '技术',
        tags: ['typescript', 'react'],
        alias: ['hello-old'],
        cover: '',
        og: undefined,
        published: true,
        visible: true,
        comments: true,
        toc: true,
        summary: 'post summary',
        body: () => null as never,
        _exports: {
          toc: [
            {
              depth: 2,
              title: createElement(Fragment, null, 'Intro', createElement('a', { href: '#intro' })),
              url: '#intro',
            },
            { depth: 3, title: 'Details', url: '#details' },
          ],
        },
        info: { path: '2024/2024-01-01-hello.mdx', fullPath: '/x' },
      },
      {
        slug: 'future',
        title: 'Future post',
        date: tomorrow,
        updated: tomorrow,
        category: '技术',
        tags: ['typescript'],
        alias: [],
        cover: '',
        og: undefined,
        published: true,
        visible: true,
        comments: true,
        toc: false,
        summary: 'future summary',
        body: () => null as never,
        info: { path: 'future.mdx', fullPath: '/x' },
      },
      {
        slug: 'hidden',
        title: 'Hidden',
        date: new Date('2024-01-01T00:00:00.000Z'),
        updated: new Date('2024-01-01T00:00:00.000Z'),
        category: '技术',
        tags: ['react'],
        alias: [],
        cover: '',
        og: undefined,
        published: true,
        visible: false,
        comments: true,
        toc: false,
        summary: '',
        body: () => null as never,
        info: { path: 'hidden.mdx', fullPath: '/x' },
      },
    ],
    pages: [
      {
        slug: 'about',
        title: 'About',
        date: new Date('2023-01-01T00:00:00.000Z'),
        updated: new Date('2023-01-01T00:00:00.000Z'),
        cover: '',
        og: undefined,
        published: true,
        comments: true,
        toc: false,
        summary: '',
        body: () => null as never,
        info: { path: 'about.mdx', fullPath: '/x' },
      },
    ],
    categories: [
      {
        info: { path: 'categories.yaml', absolutePath: '/x' },
        0: {
          name: '技术',
          slug: 'tech',
          cover: '',
          description: 'tech category',
        },
      },
    ],
    tags: [
      {
        info: { path: 'tags.yaml', absolutePath: '/x' },
        0: { name: 'typescript', slug: 'typescript' },
        // `react` is intentionally omitted to exercise the auto-derive path.
      },
    ],
    friends: [
      {
        info: { path: 'friends.yaml', absolutePath: '/x' },
        0: { website: 'Friend', description: 'x', homepage: 'https://f', poster: '' },
      },
    ],
  }
})

// Image hydration would otherwise call out to the network for every cover.
vi.mock('@/server/images/thumbhash', () => ({
  loadImageThumbhash: vi.fn(async () => undefined),
  enhanceImageHtml: vi.fn(async (html: string) => html),
}))

// Avoid the real markdown parser cold-load when categories have descriptions.
vi.mock('@/server/markdown/parser', () => ({
  parseContent: vi.fn(async (content: string) => `<p>${content}</p>\n`),
  EMPTY_COMMENT_RAW: '该留言内容为空',
  EMPTY_COMMENT_HTML: '<p>该留言内容为空</p>\n',
}))

const { ContentCatalog } = await import('@/server/catalog')

beforeEach(() => {
  ContentCatalog.reset()
})

describe('services/catalog/ContentCatalog.build', () => {
  it('public getPosts excludes future-dated and visible=false posts', async () => {
    const catalog = await ContentCatalog.get()
    expect(catalog.getPosts({ includeHidden: false, includeScheduled: false }).map((post) => post.slug)).toEqual([
      'hello',
    ])
  })

  it('allPosts retains hidden and future posts (admins / sitemap need them)', async () => {
    const catalog = await ContentCatalog.get()
    expect(catalog.allPosts.map((p) => p.slug).sort()).toEqual(['future', 'hello', 'hidden'].sort())
  })

  it('alias slugs resolve to the same canonical post', async () => {
    const catalog = await ContentCatalog.get()
    const direct = catalog.getPost('hello')
    const viaAlias = catalog.getPost('hello-old')
    expect(direct).toBeDefined()
    expect(viaAlias).toBe(direct)
  })

  it('uses compiled heading metadata even when frontmatter enables toc', async () => {
    const catalog = await ContentCatalog.get()
    expect(catalog.getPost('hello')?.headings).toEqual([
      { depth: 2, slug: 'intro', text: 'Intro' },
      { depth: 3, slug: 'details', text: 'Details' },
    ])
  })

  it('getPostsByTaxonomy returns the bucket for a category', async () => {
    const catalog = await ContentCatalog.get()
    const tech = catalog.getPostsByTaxonomy({ categoryName: '技术' }, { includeHidden: true, includeScheduled: true })
    expect(tech.map((p) => p.slug).sort()).toEqual(['future', 'hello', 'hidden'].sort())
  })

  it("auto-derives tag entries that aren't pre-declared in tags.yaml", async () => {
    const catalog = await ContentCatalog.get()
    const tag = catalog.getTagByName('react')
    expect(tag).toBeDefined()
    expect(tag?.slug).toBe('react') // pinyin of "react" yields the literal string
    expect(tag?.permalink).toBe('/tags/react')
  })

  it('category counts include hidden posts but exclude scheduled posts', async () => {
    const catalog = await ContentCatalog.get()
    const tech = catalog.getCategoryByName('技术')
    expect(tech?.counts).toBe(2)
  })

  it('tag counts include hidden posts but exclude scheduled posts', async () => {
    const catalog = await ContentCatalog.get()
    const react = catalog.getTagByName('react')
    expect(react?.counts).toBe(2)
  })

  it('permalinks set is the union of post and page permalinks', async () => {
    const catalog = await ContentCatalog.get()
    expect(catalog.permalinks.has('/posts/hello')).toBe(true)
    expect(catalog.permalinks.has('/about')).toBe(true)
  })

  it('memoizes via the singleton (consecutive get() returns the same instance)', async () => {
    const a = await ContentCatalog.get()
    const b = await ContentCatalog.get()
    expect(a).toBe(b)
  })
})
