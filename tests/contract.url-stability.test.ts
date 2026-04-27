import { describe, expect, it } from 'vite-plus/test'

import routes from '@/routes'

// External URL contract. AGENTS.md is explicit: "public URL / feed URL /
// image endpoint / sitemap / WordPress 兼容路由 / SEO meta 输出 must remain
// stable". A regression here is potentially user-visible (broken bookmarks,
// search engine deindex, RSS reader churn). This file pins every public
// route in the manifest so any rename forces an explicit test update.

interface RouteEntry {
  path?: string
  file: string
  id?: string
}

function flatten(entries: unknown[]): RouteEntry[] {
  const out: RouteEntry[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    if ('file' in entry) {
      out.push(entry as RouteEntry)
    }
    if ('children' in entry && Array.isArray((entry as { children?: unknown }).children)) {
      out.push(...flatten((entry as { children: unknown[] }).children))
    }
  }
  return out
}

describe('contract: public URL stability', () => {
  const all = flatten(routes)

  it('home + paginated home are mounted at / and /page/:num', () => {
    const home = all.find((r) => r.file === 'routes/home.tsx' && r.id === undefined)
    const homePaged = all.find((r) => r.id === 'home-page')
    expect(home).toBeDefined()
    expect(homePaged?.path).toBe('page/:num')
  })

  it('category + tag listings keep their /cats and /tags prefixes', () => {
    const paths = new Set(all.map((r) => r.path))
    for (const expected of [
      'cats/:slug',
      'cats/:slug/feed',
      'cats/:slug/feed/atom',
      'cats/:slug/page/:num',
      'tags/:slug',
      'tags/:slug/feed',
      'tags/:slug/feed/atom',
      'tags/:slug/page/:num',
    ]) {
      expect(paths.has(expected), `missing public URL: /${expected}`).toBe(true)
    }
  })

  it('RSS / Atom / sitemap routes are mounted at the historical paths', () => {
    const paths = new Set(all.map((r) => r.path))
    expect(paths.has('feed')).toBe(true)
    expect(paths.has('feed/atom')).toBe(true)
    expect(paths.has('sitemap.xml')).toBe(true)
  })

  it('image endpoints (/images/og /calendar /avatar) preserve their URL shape', () => {
    const paths = new Set(all.map((r) => r.path))
    expect(paths.has('images/og/:slug.png')).toBe(true)
    expect(paths.has('images/calendar/:year/:time.png')).toBe(true)
    expect(paths.has('images/avatar/:hash.png')).toBe(true)
  })

  it('WordPress-compatible login route is still mounted', () => {
    const paths = new Set(all.map((r) => r.path))
    expect(paths.has('wp-login.php')).toBe(true)
  })

  it('post + page detail pages still match /posts/:slug and /:slug', () => {
    const paths = all.map((r) => r.path)
    expect(paths).toContain('posts/:slug')
    expect(paths).toContain(':slug')
  })

  it('search routes (/search, /search/:keyword, paged) are unchanged', () => {
    const paths = new Set(all.map((r) => r.path))
    expect(paths.has('search')).toBe(true)
    expect(paths.has('search/:keyword')).toBe(true)
    expect(paths.has('search/:keyword/page/:num')).toBe(true)
  })

  it('the splat catch-all is mounted on routes/not-found.tsx', () => {
    const splat = all.find((r) => r.path === '*')
    expect(splat?.file).toBe('routes/not-found.tsx')
  })
})
