import config from '@/blog.config'
import { MusicPlayer } from '@/components/mdx/music/MusicPlayer'
import { Solution } from '@/components/mdx/solutions/Solution'
import { PostDetailBody } from '@/components/page/post/PostDetailBody'
import { BaseLayout } from '@/layouts/BaseLayout'
import { getPostBody } from '@/services/catalog/schema'
import { routeMeta } from '@/services/seo/meta'
import { joinUrl } from '@/shared/urls'

export async function loader({ request, params }: { request: Request; params: { slug?: string } }) {
  if (!params.slug) {
    throw new Response('Not Found', { status: 404 })
  }

  const [{ getRequestSession }, { getPost, getTag }, { loadDetailPageData }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema'),
    import('./_shared/site-data.server'),
  ])
  const post = await getPost(params.slug)
  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  const session = await getRequestSession(request)
  const [postTags, detail] = await Promise.all([
    Promise.all(post.tags.map((tag) => getTag(tag, undefined))),
    loadDetailPageData(session, joinUrl(config.website, post.permalink, '/'), post.title),
  ])

  return {
    post,
    currentPath: post.permalink,
    visibleTags: postTags.filter((tag): tag is NonNullable<typeof tag> => tag !== undefined),
    ...detail,
  }
}

export function meta({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { post } = loaderData
  return routeMeta({
    title: post.title,
    description: post.summary,
    pageUrl: post.permalink,
    ogImageUrl: post.og ? post.og : `/images/og/${post.slug}.png`,
    ogImageAltText: post.title,
    variant: { kind: 'post', article: post },
    canonical: true,
  })
}

export default function PostDetailRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const Body = getPostBody(loaderData.post.slug)
  if (!Body) {
    throw new Error(`Missing MDX body for post: ${loaderData.post.slug}`)
  }

  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath}>
      <PostDetailBody
        post={loaderData.post}
        headings={loaderData.post.headings}
        visibleTags={loaderData.visibleTags}
        sidebarPosts={loaderData.sidebarPosts}
        tags={loaderData.tags}
        admin={loaderData.admin}
        likes={loaderData.likes}
        commentData={loaderData.commentData}
        commentItems={loaderData.commentItems}
        currentUser={loaderData.currentUser}
        recentComments={loaderData.recentComments}
        pendingComments={loaderData.pendingComments}
      >
        <Body components={{ MusicPlayer, Solution }} />
      </PostDetailBody>
    </BaseLayout>
  )
}
