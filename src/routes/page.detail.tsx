import { getCatalog, toClientPage, toDetailPageShell } from '@/server/catalog'
import { detailHeaders, loadPublicDetailData, publicShouldRevalidate, redirectPermanent } from '@/server/detail'
import { notFound } from '@/server/route-helpers/http'
import { routeMeta, seoForPage } from '@/server/seo/meta'
import { PageBody, preloadPageBody } from '@/ui/mdx/MdxContent'
import { PageDetailBody } from '@/ui/post/post/PageDetailBody'
import { SectionErrorView } from '@/ui/primitives/SectionErrorView'

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
  if (!loaderData) {
    return routeMeta()
  }
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
      commentsPromise={detail.comments}
      currentUser={detail.currentUser}
    >
      <PageBody path={mdxPath} friends={friends} />
    </PageDetailBody>
  )
}

// Section-scoped error UI: lets misspelled `/:slug` pages and MDX render
// failures degrade gracefully to a card inside the regular site chrome
// instead of falling through to root's 500.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <SectionErrorView error={error} title="无法加载页面" retryHref="/" />
}
