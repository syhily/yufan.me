import type { CmsPage } from '@/server/cms/pages/projection'
import type { Page } from '@/shared/catalog'

import { toCmsPage } from '@/server/cms/pages/projection'
import {
  findContentById,
  findContentsByIds,
  findPublicPageMetaBySlug,
  listPublicPageMetas,
} from '@/server/cms/pages/repository'
import { hydrateImageRefs } from '@/server/images/render-enhance'

function isCatalogVisible(
  meta: { deletedAt: Date | null; published: boolean; publishedAt: Date },
  asOf: Date = new Date(),
): boolean {
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

async function hydratePageImages(pages: Page[]): Promise<void> {
  await hydrateImageRefs(
    pages,
    (p) => p.cover,
    (p, lookup) => {
      p.coverThumbhash = lookup?.thumbhash
      p.coverWidth = lookup?.width
      p.coverHeight = lookup?.height
      if (lookup?.publicUrl != null) {
        p.cover = lookup.publicUrl
      }
    },
  )
}

// Promote a `CmsPage` (DB-backed projection) into the public `Page` shape.
export function buildDbPage(page: CmsPage): Page {
  return {
    id: page.id,
    title: page.title,
    date: page.date,
    updated: page.updated,
    comments: page.comments,
    cover: page.cover,
    coverThumbhash: page.coverThumbhash,
    coverWidth: page.coverWidth,
    coverHeight: page.coverHeight,
    og: page.og,
    published: page.published,
    summary: page.summary,
    toc: page.toc,
    showUpdated: page.showUpdated,
    showFriends: page.showFriends,
    slug: page.slug,
    permalink: page.permalink,
    headings: page.headings,
    body: page.body,
    imageSources: page.imageSources,
    publishedRevisionId: page.publishedRevisionId,
  }
}

export async function findPageBySlug(slug: string): Promise<Page | null> {
  const meta = await findPublicPageMetaBySlug(slug)
  if (meta === null || !isCatalogVisible(meta)) {
    return null
  }
  const revision = meta.publishedRevisionId === null ? null : await findContentById(meta.publishedRevisionId)
  const page = buildDbPage(toCmsPage(meta, revision))
  await hydratePageImages([page])
  return page
}

export async function listAllPages(): Promise<Page[]> {
  const metas = await listPublicPageMetas()
  const asOf = new Date()
  const visible = metas.filter((meta) => isCatalogVisible(meta, asOf))
  if (visible.length === 0) {
    return []
  }

  const revisionIds = visible.map((m) => m.publishedRevisionId).filter((id): id is bigint => id !== null)
  const revisionMap = new Map<bigint, Awaited<ReturnType<typeof findContentsByIds>>[number]>()
  if (revisionIds.length > 0) {
    const rows = await findContentsByIds(revisionIds)
    for (const row of rows) {
      revisionMap.set(row.id, row)
    }
  }

  const pages = visible.map((meta) => {
    const revision = meta.publishedRevisionId === null ? null : (revisionMap.get(meta.publishedRevisionId) ?? null)
    return buildDbPage(toCmsPage(meta, revision))
  })
  await hydratePageImages(pages)
  return pages
}
