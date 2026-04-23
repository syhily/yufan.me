import { BaseLayout } from '@/layouts/BaseLayout'
import { HomeLayoutBody } from '@/layouts/HomeLayout'
import { routeMeta } from '@/services/seo/meta'

export async function loader({ request }: { request: Request }) {
  const [{ getRequestSession }, { getPosts }, { loadHomeListing, loadSidebarData }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema'),
    import('./_shared/site-data.server'),
  ])
  const session = await getRequestSession(request)
  const posts = await getPosts({ hidden: false, schedule: import.meta.env.DEV })
  const [sidebar, listing] = await Promise.all([loadSidebarData(session), loadHomeListing(posts, 1)])

  return {
    posts,
    currentPath: '/',
    ...sidebar,
    ...listing,
  }
}

export function meta() {
  return routeMeta()
}

export default function HomeRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath}>
      <HomeLayoutBody
        posts={loaderData.posts}
        resolvedPosts={loaderData.resolvedPosts}
        pageNum={1}
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
