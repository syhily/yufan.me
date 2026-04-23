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
  if (!params.slug || !params.num) throw new Response('Not Found', { status: 404 })

  const [{ getRequestSession, isAdmin }, { getPosts, getTag }, { loadPostListing }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema'),
    import('./_shared/site-data.server'),
  ])
  const tag = await getTag(undefined, params.slug)
  if (!tag) throw new Response('Not Found', { status: 404 })

  const pageNum = parsePageNum(params.num)
  if (pageNum <= 1) throw redirect(tag.permalink)

  const session = await getRequestSession(request)
  const posts = (await getPosts({ hidden: true, schedule: false })).filter((post) => post.tags.includes(tag.name))
  const listing = await loadPostListing(posts, pageNum, config.settings.pagination.tags)
  if (pageNum > listing.totalPage && listing.totalPage > 0) {
    throw redirect(`${tag.permalink}/page/${listing.totalPage}`)
  }
  if (listing.totalPage === 0) throw new Response('Not Found', { status: 404 })

  return {
    admin: isAdmin(session),
    currentPath: `${tag.permalink}/page/${pageNum}`,
    tag,
    pageNum,
    seo: computePostListingSeoProps({
      title: tag.name,
      pageNum,
      totalPage: listing.totalPage,
      rootPath: tag.permalink,
    }),
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

export default function TagListPageRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath}>
      <PostListingBody
        title={`标签 “${loaderData.tag.name}”`}
        resolvedPosts={loaderData.resolvedPosts}
        pageNum={loaderData.pageNum}
        totalPage={loaderData.totalPage}
        rootPath={loaderData.tag.permalink}
      />
    </BaseLayout>
  )
}
