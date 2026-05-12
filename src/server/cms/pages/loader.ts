import type { LoaderFunctionArgs } from 'react-router'

import type { ResolvedImageMeta } from '@/server/images/render-enhance'
import type { PortableTextBody } from '@/shared/pt/schema'
import type { MarkdownHeading } from '@/shared/toc'

import { getEntryBySlug } from '@/server/catalog'
import { loadPageDraftPreviewBySlug } from '@/server/cms/pages/service'
import { resolveImageMetaBySources } from '@/server/images/render-enhance'
import { buildDbPage, findPageBySlug } from '@/server/pages/query'
import { redirectPermanent } from '@/server/route-helpers/detail-loader'
import { ifNoneMatch, notModifiedResponse, weakEtag } from '@/server/route-helpers/etag'
import { notFound } from '@/server/route-helpers/http'
import { isAdmin, resolveSessionContext, tryGetSessionContext } from '@/server/session'

type DraftMarker = 'draft' | 'unpublished-draft' | 'published-draft' | null

export interface PagePreviewResult {
  page: {
    id: string
    slug: string
    title: string
    summary: string
    cover: string
    coverThumbhash?: string
    coverWidth?: number
    coverHeight?: number
    permalink: string
    date: Date
    updated?: Date
    og?: string
    comments: boolean
    toc: boolean
    showUpdated: boolean
    headings: MarkdownHeading[]
  }
  body: PortableTextBody
  showFriends: boolean
  draftMarker: DraftMarker
  publicEtag: string | null
  imageMeta: Record<string, ResolvedImageMeta>
}

export async function loadPagePreview({
  slug,
  wantsDraftPreview,
  request,
  context,
}: {
  slug: string
  wantsDraftPreview: boolean
  request: Request
  context: LoaderFunctionArgs['context']
}): Promise<PagePreviewResult> {
  const entry = await getEntryBySlug(slug)
  if (entry !== null && entry.type === 'post') {
    redirectPermanent(`/posts/${entry.slug}`)
  }

  const publishedPage =
    entry !== null && entry.type === 'page' ? ((await findPageBySlug(slug)) ?? undefined) : undefined

  let sourcePage = publishedPage
  let draftMarker: DraftMarker = null

  const needsDraftLookup = sourcePage === undefined || (wantsDraftPreview && publishedPage !== undefined)
  if (needsDraftLookup) {
    const sessionContext = tryGetSessionContext(context) ?? (await resolveSessionContext(request))
    if (isAdmin(sessionContext.session)) {
      const preview = await loadPageDraftPreviewBySlug(slug)
      if (preview !== null) {
        if (sourcePage === undefined) {
          sourcePage = buildDbPage(preview.page)
          draftMarker = 'draft'
        } else if (wantsDraftPreview) {
          if (preview.hasNewerDraft) {
            sourcePage = buildDbPage(preview.page)
            draftMarker = 'unpublished-draft'
          } else {
            draftMarker = 'published-draft'
          }
        }
      }
    }
  }

  if (sourcePage === undefined) {
    notFound()
  }

  const publicEtag =
    draftMarker === null ? weakEtag(['page', sourcePage.id, sourcePage.publishedRevisionId, sourcePage.updated]) : null
  if (publicEtag !== null && ifNoneMatch(request, publicEtag)) {
    throw notModifiedResponse(publicEtag)
  }

  const page = {
    id: sourcePage.id,
    slug: sourcePage.slug,
    title: sourcePage.title,
    summary: sourcePage.summary,
    cover: sourcePage.cover,
    coverThumbhash: sourcePage.coverThumbhash,
    coverWidth: sourcePage.coverWidth,
    coverHeight: sourcePage.coverHeight,
    permalink: sourcePage.permalink,
    date: sourcePage.date,
    updated: sourcePage.updated,
    og: sourcePage.og,
    comments: sourcePage.comments,
    toc: sourcePage.toc,
    showUpdated: sourcePage.showUpdated,
    headings: sourcePage.headings,
  }

  const imageMeta = Object.fromEntries(await resolveImageMetaBySources(sourcePage.imageSources))

  return {
    page,
    body: sourcePage.body,
    showFriends: sourcePage.showFriends,
    draftMarker,
    publicEtag,
    imageMeta,
  }
}
