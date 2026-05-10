import { data } from 'react-router'

import type { Page } from '@/shared/catalog'

import { buildDbPage, findPageBySlug, findPostBySlug, listAllFriends } from '@/server/catalog'
import { loadPageDraftPreviewBySlug } from '@/server/cms/pages/service'
import { resolveImageMetaBySources } from '@/server/images/render-enhance'
import { loadPublicDetailData, redirectPermanent } from '@/server/route-helpers/detail-loader'
import { notFound } from '@/server/route-helpers/http'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { assertNotWordPressDecoy } from '@/server/route-helpers/wp-decoy'
import { bundleFromMatches, routeMeta, seoForPage } from '@/server/seo/meta'
import { isAdmin, resolveSessionContext, tryGetSessionContext } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { resolveFootnotesSectionTitle } from '@/shared/footnotes-section-title'
import { Friends } from '@/ui/mdx/page/Friends'
import { PortableTextBody } from '@/ui/portable-text/PortableTextBody'
import { type DraftMarker, PageDetailBody } from '@/ui/post/post/PageDetailBody'

import type { Route } from './+types/page.detail'

export const handle = { footer: false }
export const headers = detailHeaders
export const shouldRevalidate = publicShouldRevalidate

export async function loader({ request, context, params }: Route.LoaderArgs) {
  assertNotWordPressDecoy(request)
  const url = new URL(request.url)
  const wantsDraftPreview = url.searchParams.get('draft') === 'true'

  const publishedPage: Page | undefined = (await findPageBySlug(params.slug)) ?? undefined

  let sourcePage: Page | undefined = publishedPage
  let draftMarker: DraftMarker = null

  const needsDraftLookup = sourcePage === undefined || (wantsDraftPreview && publishedPage !== undefined)
  if (needsDraftLookup) {
    const sessionContext = tryGetSessionContext(context) ?? (await resolveSessionContext(request))
    if (isAdmin(sessionContext.session)) {
      const preview = await loadPageDraftPreviewBySlug(params.slug)
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
    const post = await findPostBySlug(params.slug)
    if (post) {
      redirectPermanent(`/posts/${post.slug}`)
    }
    notFound()
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
    headings: sourcePage.headings,
  }

  const imageMeta = Object.fromEntries(await resolveImageMetaBySources(sourcePage.imageSources))
  const body = sourcePage.body
  const footnotesSectionTitle = resolveFootnotesSectionTitle(requireBlogSettingsSection('content'))

  const { detail, commentCsrfSetCookie } = await loadPublicDetailData({
    request,
    context,
    permalink: page.permalink,
    title: page.title,
    preload: () => Promise.resolve(),
  })

  return data(
    {
      page,
      body,
      friends: await listAllFriends(),
      showFriends: sourcePage.showFriends,
      draftMarker,
      detail,
      imageMeta,
      footnotesSectionTitle,
    },
    { headers: { 'Set-Cookie': commentCsrfSetCookie } },
  )
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const bundle = bundleFromMatches(matches)
  if (!loaderData) {
    return routeMeta(undefined, bundle)
  }
  return routeMeta(seoForPage(loaderData.page), bundle)
}

export default function PageDetailRoute({ loaderData }: Route.ComponentProps) {
  const { page, body, friends, showFriends, draftMarker, detail, imageMeta, footnotesSectionTitle } = loaderData
  return (
    <PageDetailBody
      page={page}
      headings={page.headings}
      draftMarker={draftMarker}
      likes={detail.likes}
      commentKey={detail.commentKey}
      commentCsrfToken={detail.csrfToken}
      commentsPromise={detail.comments}
      currentUser={detail.currentUser}
      admin={detail.admin}
    >
      <PortableTextBody
        body={body}
        imageMeta={imageMeta}
        headingSlugs={page.headings.map((h) => h.slug)}
        footnotesSectionTitle={footnotesSectionTitle}
      />
      {showFriends && <Friends friends={[...friends]} />}
    </PageDetailBody>
  )
}
