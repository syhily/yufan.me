import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

import routes from '@/routes'

// External URL contract. AGENTS.md is explicit: "public URL / feed URL /
// image endpoint / sitemap / WordPress 兼容路由 / SEO meta 输出 must remain
// stable". Route source of truth is now split: page routes in `src/routes.ts`,
// resource routes in the Hono entry. This test checks both by reading source
// files for URL patterns (avoids importing the full Hono app which pulls in
// heavy server deps).

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

function honoRegisteredPaths(): Set<string> {
  const paths = new Set<string>()
  const sources = [
    'src/entry/server.node.ts',
    'src/server/http/resources/feed.ts',
    'src/server/http/resources/sitemap.ts',
    'src/server/http/resources/images.ts',
    'src/server/http/resources/redirects.ts',
  ]
  for (const file of sources) {
    try {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/\.(?:get|post|patch|delete|put|all|route)\s*\(\s*['"]([^'"]+)['"]/g)) {
        paths.add(m[1])
      }
    } catch {
      /* skip missing files */
    }
  }
  return paths
}

describe('contract: public URL stability', () => {
  // RR paths lack leading '/', Hono paths include it. Normalise.
  const rrPaths = new Set(flatten(routes).map((r) => `/${r.path}`))
  const allPaths = new Set([...rrPaths, ...honoRegisteredPaths()])

  it('home + paginated home are mounted at / and /page/:num', () => {
    const all = flatten(routes)
    expect(all.find((r) => r.file === 'routes/home.tsx' && r.id === undefined)).toBeDefined()
    expect(all.find((r) => r.id === 'home-page')?.path).toBe('page/:num')
  })

  it('category + tag listings keep their /cats and /tags prefixes', () => {
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
      expect(allPaths.has(`/${expected}`), `missing: /${expected}`).toBe(true)
    }
  })

  it('RSS / Atom / sitemap routes are mounted at the historical paths', () => {
    for (const path of ['/feed', '/feed/atom', '/sitemap.xml']) {
      expect(allPaths.has(path), `missing: ${path}`).toBe(true)
    }
  })

  it('image endpoints (/images/og /calendar /avatar) preserve their URL shape', () => {
    for (const path of ['/images/og/:slug.png', '/images/calendar/:year/:time.png', '/images/avatar/:hash.png']) {
      expect(allPaths.has(path), `missing: ${path}`).toBe(true)
    }
  })

  it('WordPress compatibility URLs are still mounted', () => {
    expect(rrPaths.has('/wp-login.php')).toBe(true)
    expect(rrPaths.has('/wp-admin')).toBe(true)
    expect(rrPaths.has('/wp-admin/install.php')).toBe(true)
    expect(rrPaths.has('/wp-admin/install/settings.php')).toBe(true)
  })

  it('post + page detail pages still match /posts/:slug and /:slug', () => {
    const paths = flatten(routes).map((r) => r.path)
    expect(paths).toContain('posts/:slug')
    expect(paths).toContain(':slug')
  })

  it('search routes (/search, /search/:keyword, paged) are unchanged', () => {
    expect(allPaths.has('/search')).toBe(true)
    expect(rrPaths.has('/search/:keyword')).toBe(true)
    expect(rrPaths.has('/search/:keyword/page/:num')).toBe(true)
  })

  it('the splat catch-all is mounted on routes/not-found.tsx', () => {
    expect(flatten(routes).find((r) => r.path === '*')?.file).toBe('routes/not-found.tsx')
  })
})
