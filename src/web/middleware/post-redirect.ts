import type { MiddlewareHandler } from 'astro'

import { joinPaths } from '@astrojs/internal-helpers/path'
import { defineMiddleware } from 'astro:middleware'

import { ContentCatalog } from '@/data/content/catalog'
import { isAdminEndpoint, isAdminPath } from '@/web/middleware/admin-endpoints'

// Build the legacy permalink → canonical permalink lookup once. The catalog
// already memoises itself so calling `.get()` is cheap on subsequent hits.
let mappingsPromise: Promise<Map<string, string>> | null = null
function getMappings(): Promise<Map<string, string>> {
  if (mappingsPromise === null) {
    mappingsPromise = (async () => {
      const catalog = await ContentCatalog.get()
      const map = new Map<string, string>()
      for (const post of catalog.getPosts({ hidden: true, schedule: false })) {
        const sources = [
          joinPaths('/', post.slug),
          ...post.alias.flatMap((alias) => [joinPaths('/', alias), joinPaths('/posts/', alias)]),
        ]
        for (const source of sources) {
          if (map.has(source)) {
            throw new Error(`Duplicate request path ${source} in post alias slug`)
          }
          if (isAdminPath(source) || isAdminEndpoint(source)) {
            throw new Error(`Preserved request path: ${source}`)
          }
          map.set(source, post.permalink)
        }
      }
      return map
    })()
  }
  return mappingsPromise
}

export const postUrlRedirect: MiddlewareHandler = defineMiddleware(
  async ({ request: { method }, url: { pathname }, redirect }, next) => {
    if (method !== 'GET') return next()
    const mappings = await getMappings()
    const key = pathname.endsWith('/') ? pathname.substring(0, pathname.length - 1) : pathname
    const newTarget = mappings.get(key)
    if (newTarget !== undefined) {
      return redirect(newTarget, 301)
    }
    return next()
  },
)
