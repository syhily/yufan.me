import { data } from 'react-router'

import type { Page } from '@/server/catalog'

import { buildDbPage, getCatalog, toClientPage, toDetailPageShell } from '@/server/catalog'
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
  // Probe interception lives HERE (and in `routes/not-found.tsx`)
  // instead of root middleware: a throw originating inside a leaf
  // loader bubbles up to the closest `ErrorBoundary`
  // (`routes/public.layout.tsx`'s, with synchronous `<PublicChrome>`),
  // whereas a throw from a pre-`next()` root middleware forces React
  // Router to render the highest-loaded route's boundary (root) where
  // the chrome only ships through a `React.lazy()` chunk and the
  // header/menu/footer flash in late.
  assertNotWordPressDecoy(request)
  const url = new URL(request.url)
  const wantsDraftPreview = url.searchParams.get('draft') === 'true'

  const catalog = await getCatalog()
  const publishedPage: Page | undefined = catalog.getPage(params.slug)

  // Two branches resolve into the SAME shape: `sourcePage` (the body
  // we render) + `draftMarker` (the red label painted next to the
  // title). Keeping them as one named-state-object instead of three
  // booleans avoids the matrix that
  // `architecture-avoid-boolean-props` warns about.
  let sourcePage: Page | undefined = publishedPage
  let draftMarker: DraftMarker = null

  // Branch A — catalog miss. Either the page is unpublished, scheduled,
  // soft-deleted, or just doesn't exist. Anonymous visitors get 404
  // in every environment. Logged-in admins fall back to a live DB
  // lookup so an unpublished / never-published row stays previewable
  // through the same URL it'll have once it goes live.
  //
  // Branch B — catalog hit + `?draft=true`. The page is publicly live
  // but a logged-in admin wants to preview the latest in-progress
  // draft (or confirm there's no newer draft). The query parameter
  // is silently ignored for anonymous visitors and for non-admins.
  //
  // Both branches share `loadPageDraftPreviewBySlug`; the marker
  // differs based on published-state + hasNewerDraft.
  const needsDraftLookup = sourcePage === undefined || (wantsDraftPreview && publishedPage !== undefined)
  if (needsDraftLookup) {
    const sessionContext = tryGetSessionContext(context) ?? (await resolveSessionContext(request))
    if (isAdmin(sessionContext.session)) {
      const preview = await loadPageDraftPreviewBySlug(params.slug)
      if (preview !== null) {
        if (sourcePage === undefined) {
          // Branch A: unpublished page, admin preview.
          sourcePage = buildDbPage(preview.page)
          draftMarker = 'draft'
        } else if (wantsDraftPreview) {
          // Branch B: published page + admin asked for the draft
          // overlay. When a newer draft exists we swap the body for
          // it; otherwise we keep the published body and just badge
          // the title.
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
    const post = catalog.getPost(params.slug)
    if (post) {
      redirectPermanent(`/posts/${post.slug}`)
    }
    notFound()
  }

  const page = toDetailPageShell(toClientPage(sourcePage))

  // The image source list is captured at save time from the body's
  // PortableText `image` blocks; the SSR layer resolves thumbhash +
  // intrinsic dimensions through the `image` table cache so the
  // public renderer can hydrate `<MdxImg>` placeholders without an
  // extra round trip.
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
      friends: catalog.friends,
      // Lifted out of `page` so the loader can pass the boolean to
      // the component without growing `DetailPageShell` (the chrome
      // doesn't care about this — only the body rendering does).
      showFriends: sourcePage.showFriends,
      // The on-title draft marker. `null` for the standard public
      // render; one of `'draft' | 'unpublished-draft' |
      // 'published-draft'` for the admin preview branches above.
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
    >
      <PortableTextBody
        body={body}
        imageMeta={imageMeta}
        headingSlugs={page.headings.map((h) => h.slug)}
        footnotesSectionTitle={footnotesSectionTitle}
      />
      {/*
        Meta-driven friends grid. Renders **after** the body so the
        operator can opt into the section without touching the
        PortableText document (and without re-publishing).
      */}
      {showFriends && <Friends friends={[...friends]} />}
    </PageDetailBody>
  )
}
