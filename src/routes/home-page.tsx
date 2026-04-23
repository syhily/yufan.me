import { redirect } from 'react-router'

import { BaseLayout } from '@/layouts/BaseLayout'
import { HomeLayoutBody, computeHomeSeoProps } from '@/layouts/HomeLayout'
import { routeMeta } from '@/services/seo/meta'

function parsePageNum(raw: string) {
  const pageNum = Number.parseInt(raw, 10)
  if (Number.isNaN(pageNum)) {
    throw new Response('Invalid page number', { status: 404 })
  }
  return pageNum
}

export async function loader({ request, params }: { request: Request; params: { num?: string } }) {
  const pageNum = parsePageNum(params.num ?? '')
  if (pageNum < 1) {
    throw redirect('/')
  }

  const [{ getRequestSession }, { getPosts }, { loadHomeListing, loadSidebarData }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema'),
    import('./_shared/site-data.server'),
  ])
  const session = await getRequestSession(request)
  const posts = await getPosts({ hidden: false, schedule: import.meta.env.DEV })
  const [sidebar, listing] = await Promise.all([loadSidebarData(session), loadHomeListing(posts, pageNum)])

  if (pageNum > listing.totalPage && listing.totalPage > 0) {
    throw redirect(`/page/${listing.totalPage}`)
  }
  if (listing.totalPage === 0) {
    throw new Response('Not Found', { status: 404 })
  }

  return {
    pageNum,
    posts,
    currentPath: `/page/${pageNum}`,
    seo: computeHomeSeoProps(posts, pageNum),
    ...sidebar,
    ...listing,
  }
}

export function meta({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return routeMeta({
    title: loaderData.seo.pageTitle,
    pageUrl: loaderData.seo.canonicalUrl,
    canonical: true,
    prevUrl: loaderData.seo.prevUrl,
    nextUrl: loaderData.seo.nextUrl,
    noindex: loaderData.seo.noindex,
  })
}

export default function HomePageRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath}>
      <HomeLayoutBody
        posts={loaderData.posts}
        resolvedPosts={loaderData.resolvedPosts}
        pageNum={loaderData.pageNum}
        totalPage={loaderData.totalPage}
        categoryLinks={loaderData.categoryLinks}
        tags={loaderData.tags}
        admin={loaderData.admin}
        recentComments={loaderData.recentComments}
        pendingComments={loaderData.pendingComments}
      />
    </BaseLayout>
  )
}
