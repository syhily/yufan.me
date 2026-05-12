import { data } from 'react-router'

import { listAllFriends } from '@/server/catalog'
import { loadPagePreview } from '@/server/cms/pages/loader'
import { loadPublicDetailData } from '@/server/route-helpers/detail-loader'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { assertNotWordPressDecoy } from '@/server/route-helpers/wp-decoy'
import { bundleFromMatches, routeMeta, seoForPage } from '@/server/seo/meta'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { resolveFootnotesSectionTitle } from '@/shared/footnotes-section-title'
import { PageDetailBody } from '@/ui/post/post/PageDetailBody'
import { Friends } from '@/ui/pt/blocks/Friends'
import { PortableTextBody } from '@/ui/pt/render'

import type { Route } from './+types/page.detail'

export const handle = { footer: false }
export const headers = detailHeaders
export const shouldRevalidate = publicShouldRevalidate

export async function loader({ request, context, params }: Route.LoaderArgs) {
  assertNotWordPressDecoy(request)
  const url = new URL(request.url)
  const wantsDraftPreview = url.searchParams.get('draft') === 'true'

  const [preview, friends] = await Promise.all([
    loadPagePreview({ slug: params.slug, wantsDraftPreview, request, context }),
    listAllFriends(),
  ])

  const footnotesSectionTitle = resolveFootnotesSectionTitle(requireBlogSettingsSection('content'))

  const { detail, commentCsrfSetCookie } = await loadPublicDetailData({
    request,
    context,
    target: { type: 'page', ownerId: BigInt(preview.page.id) },
    preload: () => Promise.resolve(),
  })

  return data(
    {
      page: preview.page,
      body: preview.body,
      friends,
      showFriends: preview.showFriends,
      draftMarker: preview.draftMarker,
      detail,
      imageMeta: preview.imageMeta,
      footnotesSectionTitle,
    },
    {
      headers:
        preview.publicEtag === null
          ? { 'Set-Cookie': commentCsrfSetCookie }
          : { 'Set-Cookie': commentCsrfSetCookie, ETag: preview.publicEtag },
    },
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
