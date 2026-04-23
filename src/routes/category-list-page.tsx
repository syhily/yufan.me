import { redirect } from 'react-router'

import config from '@/blog.config'
import { BaseLayout } from '@/layouts/BaseLayout'
import { PostListingBody, computePostListingSeoProps } from '@/layouts/PostListingLayout'
import { routeMeta } from '@/services/seo/meta'

function parsePageNum(raw: string) {
  const value = Number.parseInt(raw, 10)
  if (Number.isNaN(value)) throw new Response('Not Found', { status: 404 })
  return value
}

export async function loader({ request, params }: { request: Request; params: { slug?: string; num?: string } }) {
  if (!params.slug || !params.num) {
    throw new Response('Not Found', { status: 404 })
  }

  const [{ getRequestSession, isAdmin }, { getCategory, getPosts }, { loadPostListing }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema'),
    import('./_shared/site-data.server'),
  ])
  const category = await getCategory(undefined, params.slug)
  if (!category) {
    throw new Response('Not Found', { status: 404 })
  }

  const pageNum = parsePageNum(params.num)
  if (pageNum <= 1) {
    throw redirect(category.permalink)
  }

  const session = await getRequestSession(request)
  const posts = (await getPosts({ hidden: true, schedule: false })).filter((post) => post.category === category.name)
  const listing = await loadPostListing(posts, pageNum, config.settings.pagination.category)

  if (pageNum > listing.totalPage && listing.totalPage > 0) {
    throw redirect(`${category.permalink}/page/${listing.totalPage}`)
  }
  if (listing.totalPage === 0) {
    throw new Response('Not Found', { status: 404 })
  }

  return {
    admin: isAdmin(session),
    currentPath: `${category.permalink}/page/${pageNum}`,
    category,
    pageNum,
    seo: computePostListingSeoProps({
      title: category.name,
      pageNum,
      totalPage: listing.totalPage,
      rootPath: category.permalink,
    }),
    ...listing,
  }
}

export function meta({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return routeMeta({
    title: loaderData.seo.pageTitle,
    description: loaderData.category.description,
    pageUrl: loaderData.seo.canonicalUrl,
    canonical: true,
    prevUrl: loaderData.seo.prevUrl,
    nextUrl: loaderData.seo.nextUrl,
    noindex: loaderData.seo.noindex,
  })
}

export default function CategoryListPageRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath}>
      <PostListingBody
        title={loaderData.category.name}
        description={loaderData.category.description}
        resolvedPosts={loaderData.resolvedPosts}
        pageNum={loaderData.pageNum}
        totalPage={loaderData.totalPage}
        rootPath={loaderData.category.permalink}
      />
    </BaseLayout>
  )
}
