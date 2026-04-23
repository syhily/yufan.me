import { ArchivesBody } from '@/components/page/archives/ArchivesBody'
import { BaseLayout } from '@/layouts/BaseLayout'
import { routeMeta } from '@/services/seo/meta'

export async function loader({ request }: { request: Request }) {
  const [{ getRequestSession, isAdmin }, { getPosts, getPostsWithMetadata }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema.server'),
  ])
  const session = await getRequestSession(request)
  const posts = await getPosts({ hidden: false, schedule: false })
  const resolvedPosts = await getPostsWithMetadata(posts, {
    likes: true,
    views: true,
    comments: false,
  })
  return {
    admin: isAdmin(session),
    currentPath: '/archives',
    resolvedPosts,
  }
}

export function meta() {
  return routeMeta({ title: '归档' })
}

export default function ArchivesRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath}>
      <ArchivesBody resolvedPosts={loaderData.resolvedPosts} />
    </BaseLayout>
  )
}
