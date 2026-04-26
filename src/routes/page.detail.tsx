import { getCatalog, toClientPage, toDetailPageShell } from '@/server/catalog'
import { loadPublicDetailData, redirectPermanent } from '@/server/route-helpers/detail-loader'
import { notFound } from '@/server/route-helpers/http'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { routeMeta, seoForPage } from '@/server/seo/meta'
import { PageBody, preloadPageBody } from '@/ui/mdx/MdxContent'
import { PageDetailBody } from '@/ui/post/post/PageDetailBody'

import type { Route } from './+types/page.detail'

export const handle = { footer: false }
export const headers = detailHeaders
export const shouldRevalidate = publicShouldRevalidate

export async function loader({ request, context, params }: Route.LoaderArgs) {
  // WordPress probes are intercepted by `wpDecoyMiddleware` on the root
  // route before any loader runs, so we don't re-check them here.
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
  const { detail } = await loadPublicDetailData({
    request,
    context,
    permalink: page.permalink,
    title: page.title,
    preload: () => preloadPageBody(sourcePage.mdxPath),
  })

  return {
    page,
    mdxPath: sourcePage.mdxPath,
    friends: catalog.friends,
    detail,
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return routeMeta()
  return routeMeta(seoForPage(loaderData.page))
}

export default function PageDetailRoute({ loaderData }: Route.ComponentProps) {
  const { page, mdxPath, friends, detail } = loaderData
  return (
    <PageDetailBody
      page={page}
      headings={page.headings}
      likes={detail.likes}
      commentKey={detail.commentKey}
      commentData={detail.commentData}
      commentItems={detail.commentItems}
      currentUser={detail.currentUser}
    >
      <PageBody path={mdxPath} friends={friends} />
    </PageDetailBody>
  )
}
