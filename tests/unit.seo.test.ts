import type { MetaDescriptor } from 'react-router'

import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import type { BlogSettings } from '@/shared/blog-config'

import { pageTitle, routeMeta } from '@/server/seo/meta'
import { setBlogSettingsSnapshotForTests } from '@/server/settings/snapshot'

import { TEST_BLOG_SETTINGS } from './_helpers/blog-settings'

// `routeMeta` and `pageTitle` consult `getBlogConfigSync()` for the
// site title / website / OG defaults. There is no longer a baked-in
// `DEFAULT_SETTINGS`, so the test suite seeds an explicit fixture
// snapshot before the assertions run and tears it down afterwards so
// other test files don't observe leaked global state.
const fixture: BlogSettings = {
  title: 'Test Blog',
  description: 'Test description',
  website: 'https://test.example',
  keywords: ['react', 'router'],
  author: { name: 'tester', email: 'test@example.com', url: 'https://test.example' },
  navigation: [],
  socials: [],
  settings: {
    asset: { host: 'cdn.test.example', scheme: 'https' },
    locale: 'zh-CN',
    timeZone: 'UTC',
    timeFormat: 'yyyy-LL-dd HH:mm',
    twitter: '@tester',
    pagination: { posts: 12, category: 12, tags: 12, search: 12 },
    feed: { full: false, size: 20 },
    post: { sort: 'desc' },
    sidebar: { calendar: true, search: true, comment: 5, post: 5, tag: 20 },
    comments: { size: 10, avatar: { mirror: 'https://cdn.test.example/avatar', size: 80 } },
    toc: { minHeadingLevel: 2, maxHeadingLevel: 4 },
    og: { width: 1200, height: 630 },
    footer: { initialYear: 2024, icpNo: '', moeIcpNo: '' },
    mail: { enabled: false, host: '', apiKey: '', sender: '' },
    cache: {
      og: { prefix: 'og:', ttlSeconds: 3600 },
      calendar: { prefix: 'calendar:', ttlSeconds: 3600 },
      avatar: { prefix: 'avatar:', ttlSeconds: 3600 },
    },
  },
}

beforeAll(() => {
  setBlogSettingsSnapshotForTests(fixture)
})

afterAll(() => {
  // Restore the global fixture installed by `tests/setup.ts` so other
  // tests sharing the worker still have a hydrated snapshot.
  setBlogSettingsSnapshotForTests(TEST_BLOG_SETTINGS)
})

// Helpers to find a meta tag by predicate. routeMeta produces a heterogeneous
// list of `name`, `property`, and `tagName: link` entries — we treat it as a
// flat map and assert the relevant keys are present and correct.
type MetaEntry = MetaDescriptor & Record<string, unknown>

function findByName(meta: MetaEntry[], name: string) {
  return meta.find((m) => m.name === name) as MetaEntry | undefined
}
function findByProperty(meta: MetaEntry[], property: string) {
  return meta.find((m) => m.property === property) as MetaEntry | undefined
}
function findLink(meta: MetaEntry[], rel: string) {
  return meta.find((m) => m.tagName === 'link' && m.rel === rel) as MetaEntry | undefined
}

describe('services/seo/meta — pageTitle', () => {
  it('returns the site default title when no override is supplied', () => {
    expect(pageTitle()).toBe(`${fixture.title} - ${fixture.description}`)
  })

  it('appends the site name to per-page titles', () => {
    expect(pageTitle('文章标题')).toBe(`文章标题 - ${fixture.title}`)
  })
})

describe('services/seo/meta — routeMeta', () => {
  it('emits the standard base/robots/og/twitter tags by default', () => {
    const meta = routeMeta() as MetaEntry[]
    expect(findByName(meta, 'robots')?.content).toBe('index, follow')
    expect(findByProperty(meta, 'og:type')?.content).toBe('website')
    expect(findByProperty(meta, 'og:title')).toBeDefined()
    expect(findByProperty(meta, 'twitter:card')?.content).toBe('summary_large_image')
    expect(findLink(meta, 'alternate')).toBeDefined()
    expect(findLink(meta, 'icon')).toBeDefined()
  })

  it('flips robots tags to noindex when noindex=true', () => {
    const meta = routeMeta({ noindex: true }) as MetaEntry[]
    expect(findByName(meta, 'robots')?.content).toBe('noindex,follow')
    expect(findByName(meta, 'googlebot')?.content).toBe('noindex,follow')
  })

  it('emits article-specific tags for `kind: post` variants', () => {
    const meta = routeMeta({
      title: 'Hello',
      variant: {
        kind: 'post',
        article: {
          date: new Date('2024-01-02T03:04:05.000Z'),
          updated: new Date('2024-02-03T00:00:00.000Z'),
          category: '默认分类',
          tags: ['typescript', 'react'],
        },
      },
    }) as MetaEntry[]

    expect(findByProperty(meta, 'og:type')?.content).toBe('article')
    expect(findByProperty(meta, 'article:published_time')?.content).toBe('2024-01-02T03:04:05.000Z')
    expect(findByProperty(meta, 'article:modified_time')?.content).toBe('2024-02-03T00:00:00.000Z')
    expect(findByProperty(meta, 'article:section')?.content).toBe('默认分类')
    const tagEntries = meta.filter((m) => m.property === 'article:tag')
    expect(tagEntries.map((entry) => entry.content)).toEqual(['typescript', 'react'])
  })

  it('emits canonical/prev/next links only when requested', () => {
    const meta = routeMeta({
      pageUrl: '/posts/hello',
      canonical: true,
      prevUrl: '/posts/page/1',
      nextUrl: '/posts/page/3',
    }) as MetaEntry[]

    expect(findLink(meta, 'canonical')?.href).toBe(`${fixture.website}/posts/hello`)
    expect(findLink(meta, 'prev')?.href).toBe(`${fixture.website}/posts/page/1`)
    expect(findLink(meta, 'next')?.href).toBe(`${fixture.website}/posts/page/3`)
  })

  it('falls back to the default OG image when ogImageUrl is missing', () => {
    const meta = routeMeta() as MetaEntry[]
    const og = findByProperty(meta, 'og:image')
    expect(og?.content).toContain('/images/open-graph.png')
    expect(String(og?.content).startsWith('http')).toBe(true)
  })
})
