import type { MetaDescriptor } from 'react-router'

import { describe, expect, it } from 'vite-plus/test'

import config from '@/blog.config'
import { pageTitle, routeMeta } from '@/server/seo/meta'

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
    expect(pageTitle()).toBe(`${config.title} - ${config.description}`)
  })

  it('appends the site name to per-page titles', () => {
    expect(pageTitle('文章标题')).toBe(`文章标题 - ${config.title}`)
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

    expect(findLink(meta, 'canonical')?.href).toBe(`${config.website}/posts/hello`)
    expect(findLink(meta, 'prev')?.href).toBe(`${config.website}/posts/page/1`)
    expect(findLink(meta, 'next')?.href).toBe(`${config.website}/posts/page/3`)
  })

  it('falls back to the default OG image when ogImageUrl is missing', () => {
    const meta = routeMeta() as MetaEntry[]
    const og = findByProperty(meta, 'og:image')
    expect(og?.content).toContain('/images/open-graph.png')
    expect(String(og?.content).startsWith('http')).toBe(true)
  })
})
