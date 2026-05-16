import type { CatalogEntry, CatalogSnapshot } from '@/server/domains/catalog/snapshot'

import { validateSlugFence } from '@/server/domains/catalog/fence'
import { listPublicPageMetas } from '@/server/domains/pages/repo'
import { listPublicPostMetas } from '@/server/domains/posts/repo'

function isPublished(meta: { deletedAt: Date | null; published: boolean; publishedAt: Date }, asOf: Date): boolean {
  if (meta.deletedAt !== null) {
    return false
  }
  if (!meta.published) {
    return false
  }
  if (meta.publishedAt.getTime() > asOf.getTime()) {
    return false
  }
  return true
}

export async function buildCatalogSnapshot(): Promise<CatalogSnapshot> {
  const asOf = new Date()
  const [pageMetas, postMetas] = await Promise.all([listPublicPageMetas(), listPublicPostMetas()])

  const pages: CatalogEntry[] = pageMetas
    .filter((m) => isPublished(m, asOf))
    .map((m) => ({ type: 'page', id: m.id, slug: m.slug }))
  const posts: CatalogEntry[] = postMetas
    .filter((m) => isPublished(m, asOf))
    .map((m) => ({ type: 'post', id: m.id, slug: m.slug }))

  const all = [...posts, ...pages]
  validateSlugFence(all)

  const bySlug = new Map<string, CatalogEntry>()
  for (const entry of all) {
    bySlug.set(entry.slug, entry)
  }

  return { bySlug, posts, pages, builtAt: asOf }
}
