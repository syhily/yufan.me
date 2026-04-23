import { redirect } from 'react-router'

import config from '@/blog.config'
import { BaseLayout } from '@/layouts/BaseLayout'
import { PostListingBody } from '@/layouts/PostListingLayout'
import { routeMeta } from '@/services/seo/meta'

function parsePageNum(raw: string) {
  const pageNum = Number.parseInt(raw, 10)
  if (Number.isNaN(pageNum)) {
    throw new Response('Invalid page number', { status: 404 })
  }
  return pageNum
}

export async function loader({ request, params }: { request: Request; params: { keyword?: string; num?: string } }) {
  const query = params.keyword?.trim() ?? ''
  if (query === '' || !params.num) {
    throw redirect('/')
  }

  const pageNum = parsePageNum(params.num)
  if (pageNum <= 1) {
    throw redirect(`/search/${query}`)
  }

  const [{ getRequestSession, isAdmin }, { getPosts, getPostsWithMetadata }, { searchPosts }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema.server'),
    import('@/services/search'),
  ])
  const session = await getRequestSession(request)
  const { hits, page, totalPages } = await searchPosts(
    query,
    config.settings.pagination.search,
    (pageNum - 1) * config.settings.pagination.search,
  )

  if (hits.length === 0) {
    throw redirect('/', { status: 302 })
  }

  const allPosts = await getPosts({ hidden: true, schedule: false })
  const posts = hits.map((slug) => allPosts.find((post) => post.slug === slug)).filter((post) => post !== undefined)
  const resolvedPosts = await getPostsWithMetadata(posts, {
    likes: true,
    views: true,
    comments: false,
  })

  return {
    admin: isAdmin(session),
    currentPath: `/search/${query}/page/${page}`,
    query,
    title: `【${query}】搜索结果`,
    pageNum: page,
    totalPage: totalPages,
    resolvedPosts,
  }
}

export function meta({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return routeMeta({
    title: `${loaderData.title} · 第 ${loaderData.pageNum} 页`,
    pageUrl: loaderData.currentPath,
    canonical: true,
    prevUrl: loaderData.pageNum > 1 ? `/search/${loaderData.query}/page/${loaderData.pageNum - 1}` : undefined,
    nextUrl:
      loaderData.pageNum < loaderData.totalPage
        ? `/search/${loaderData.query}/page/${loaderData.pageNum + 1}`
        : undefined,
    noindex: true,
  })
}

export default function SearchListPageRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
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
