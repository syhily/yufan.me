import config from '@/blog.config'
import { MusicPlayer } from '@/components/mdx/music/MusicPlayer'
import { Friends } from '@/components/mdx/page/Friends'
import { Solution } from '@/components/mdx/solutions/Solution'
import { PageDetailBody } from '@/components/page/post/PageDetailBody'
import { BaseLayout } from '@/layouts/BaseLayout'
import { getPageBody } from '@/services/catalog/schema'
import { routeMeta } from '@/services/seo/meta'
import { joinUrl } from '@/shared/urls'

export async function loader({ request, params }: { request: Request; params: { slug?: string } }) {
  if (!params.slug) {
    throw new Response('Not Found', { status: 404 })
  }

  const [{ getRequestSession }, { getPage }, { loadDetailPageData }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema'),
    import('./_shared/site-data.server'),
  ])
  const page = await getPage(params.slug)
  if (!page) {
    throw new Response('Not Found', { status: 404 })
  }

  const session = await getRequestSession(request)
  const detail = await loadDetailPageData(session, joinUrl(config.website, page.permalink, '/'), page.title)

  return {
    page,
    currentPath: page.permalink,
    ...detail,
  }
}

export function meta({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { page } = loaderData
  return routeMeta({
    title: page.title,
    description: page.summary,
    ogImageUrl: page.og ? page.og : `/images/og/${page.slug}.png`,
    ogImageAltText: page.title,
    variant: { kind: 'page', article: page },
  })
}

export default function PageDetailRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const Body = getPageBody(loaderData.page.slug)
  if (!Body) {
    throw new Error(`Missing MDX body for page: ${loaderData.page.slug}`)
  }

  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath} footer={false}>
      <PageDetailBody
        page={loaderData.page}
        headings={loaderData.page.headings}
        likes={loaderData.likes}
        commentData={loaderData.commentData}
        commentItems={loaderData.commentItems}
        currentUser={loaderData.currentUser}
      >
        <Body components={{ Friends, MusicPlayer, Solution }} />
      </PageDetailBody>
    </BaseLayout>
  )
}
