import { getCatalog, toDetailPostShell } from '@/server/catalog'
import { loadPublicDetailData, redirectPermanent, requireDetailSource } from '@/server/route-helpers/detail-loader'
import { canonicalPostPath } from '@/server/route-helpers/paths'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { routeMeta, seoForPost } from '@/server/seo/meta'
import { PostBody, preloadPostBody } from '@/ui/mdx/MdxContent'
import { PostDetailBody } from '@/ui/post/post/PostDetailBody'

import type { Route } from './+types/post.detail'

export const headers = detailHeaders
export const shouldRevalidate = publicShouldRevalidate

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const catalog = await getCatalog()
  const sourcePost = requireDetailSource(catalog.getPost(params.slug))
  const clientPost = catalog.toClientPost(sourcePost)
  const canonical = canonicalPostPath(params.slug, clientPost.slug)
  if (canonical !== undefined) {
    redirectPermanent(canonical)
  }

  const post = toDetailPostShell(clientPost)
  const visibleTags = catalog.getTagsByName(post.tags)
  const { detail, sidebar } = await loadPublicDetailData({
    request,
    context,
    permalink: post.permalink,
    title: post.title,
    preload: () => preloadPostBody(sourcePost.mdxPath),
    sidebar: {
      posts: catalog.getClientPosts({ includeHidden: false, includeScheduled: false }),
      tags: catalog.tags,
    },
  })

  return {
    post,
    mdxPath: sourcePost.mdxPath,
    visibleTags,
    sidebarPosts: sidebar?.posts ?? [],
    tags: sidebar?.tags ?? [],
    detail,
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return routeMeta()
  return routeMeta(seoForPost(loaderData.post))
}

export default function PostDetailRoute({ loaderData }: Route.ComponentProps) {
  const { post, mdxPath, visibleTags, sidebarPosts, tags, detail } = loaderData
  return (
    <PostDetailBody
      post={post}
      headings={post.headings}
      visibleTags={visibleTags}
      admin={detail.admin}
      likes={detail.likes}
      commentKey={detail.commentKey}
      commentsPromise={detail.comments}
      currentUser={detail.currentUser}
      sidebar={{
        posts: sidebarPosts,
        tags,
        recentComments: detail.recentComments,
        pendingComments: detail.pendingComments,
      }}
    >
      <PostBody path={mdxPath} />
    </PostDetailBody>
  )
}
