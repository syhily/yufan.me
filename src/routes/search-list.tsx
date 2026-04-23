import { redirect } from 'react-router'

import config from '@/blog.config'
import { BaseLayout } from '@/layouts/BaseLayout'
import { PostListingBody } from '@/layouts/PostListingLayout'
import { routeMeta } from '@/services/seo/meta'

export async function loader({ request, params }: { request: Request; params: { keyword?: string } }) {
  const query = params.keyword?.trim() ?? ''
  if (query === '') {
    throw redirect('/')
  }

  const [{ getRequestSession, isAdmin }, { getPosts, getPostsWithMetadata }, { searchPosts }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema.server'),
    import('@/services/search'),
  ])
  const session = await getRequestSession(request)
  const { hits, page, totalPages } = await searchPosts(query, config.settings.pagination.search)
  const allPosts = await getPosts({ hidden: true, schedule: false })
  const posts = hits.map((slug) => allPosts.find((post) => post.slug === slug)).filter((post) => post !== undefined)
  const resolvedPosts = await getPostsWithMetadata(posts, {
    likes: true,
    views: true,
    comments: false,
  })

  return {
    admin: isAdmin(session),
    currentPath: `/search/${query}`,
    query,
    title: `【${query}】搜索结果`,
    pageNum: page,
    totalPage: totalPages,
    resolvedPosts,
  }
}

export function meta({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return routeMeta({
    title: loaderData.title,
    pageUrl: `/search/${loaderData.query}`,
    canonical: true,
    noindex: true,
  })
}

export default function SearchListRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath}>
      <PostListingBody
        title={loaderData.title}
        resolvedPosts={loaderData.resolvedPosts}
        pageNum={loaderData.pageNum}
        totalPage={loaderData.totalPage}
        rootPath={`/search/${loaderData.query}`}
        alwaysRenderPagination={false}
      />
    </BaseLayout>
  )
}
