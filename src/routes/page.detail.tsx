import { data } from 'react-router'

import { getCatalog, toClientPage, toDetailPageShell } from '@/server/catalog'
import { resolveImageMetaBySources } from '@/server/images/render-enhance'
import { loadPublicDetailData, redirectPermanent } from '@/server/route-helpers/detail-loader'
import { notFound } from '@/server/route-helpers/http'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { assertNotWordPressDecoy } from '@/server/route-helpers/wp-decoy'
import { bundleFromMatches, routeMeta, seoForPage } from '@/server/seo/meta'
import { PageBody, preloadPageBody } from '@/ui/mdx/MdxContent'
import { PageDetailBody } from '@/ui/post/post/PageDetailBody'

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
  const catalog = await getCatalog()
  const sourcePage = catalog.getPage(params.slug)
  if (!sourcePage) {
    const post = catalog.getPost(params.slug)
    if (post) {
      redirectPermanent(`/posts/${post.slug}`)
    }
    notFound()
  }
  const page = toDetailPageShell(toClientPage(sourcePage))

  // Resolve image metadata (thumbhash, width, height) from the database.
  // The image URLs were discovered at build time via `remarkCollectImages`
  // and are available on `sourcePage.imageSources`.
  const imageMeta = Object.fromEntries(await resolveImageMetaBySources(sourcePage.imageSources))

  const { detail, commentCsrfSetCookie } = await loadPublicDetailData({
    request,
    context,
    permalink: page.permalink,
    title: page.title,
    preload: () => preloadPageBody(sourcePage.mdxPath),
  })

  return data(
    {
      page,
      mdxPath: sourcePage.mdxPath,
      friends: catalog.friends,
      detail,
      imageMeta,
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
  const { page, mdxPath, friends, detail, imageMeta } = loaderData
  return (
    <PageDetailBody
      page={page}
      headings={page.headings}
      likes={detail.likes}
      commentKey={detail.commentKey}
      commentCsrfToken={detail.csrfToken}
      commentsPromise={detail.comments}
      currentUser={detail.currentUser}
    >
      <PageBody path={mdxPath} friends={friends} imageMeta={imageMeta} />
    </PageDetailBody>
  )
}
