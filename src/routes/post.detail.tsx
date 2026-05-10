import { data } from 'react-router'

import { getCatalog, toDetailPostShell } from '@/server/catalog'
import { resolveImageMetaBySources } from '@/server/images/render-enhance'
import { loadPublicDetailData, redirectPermanent, requireDetailSource } from '@/server/route-helpers/detail-loader'
import { canonicalPostPath } from '@/server/route-helpers/paths'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { bundleFromMatches, routeMeta, seoForPost } from '@/server/seo/meta'
import { PortableTextBody } from '@/ui/portable-text/PortableTextBody'
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

  const imageMeta = Object.fromEntries(await resolveImageMetaBySources(sourcePost.imageSources))

  const { detail, sidebar, commentCsrfSetCookie } = await loadPublicDetailData({
    request,
    context,
    permalink: post.permalink,
    title: post.title,
    preload: () => Promise.resolve(),
    sidebar: {
      posts: catalog.getClientPosts({ includeHidden: false, includeScheduled: false }),
      tags: catalog.tags,
    },
  })

  return data(
    {
      post,
      body: sourcePost.body,
      visibleTags,
      sidebarPosts: sidebar?.posts ?? [],
      tags: sidebar?.tags ?? [],
      detail,
      imageMeta,
    },
    { headers: { 'Set-Cookie': commentCsrfSetCookie } },
  )
}

export function meta({ loaderData, matches }: Route.MetaArgs) {
  const bundle = bundleFromMatches(matches)
  if (!loaderData) {
    return routeMeta(undefined, bundle)
  }
  return routeMeta(seoForPost(loaderData.post), bundle)
}

export default function PostDetailRoute({ loaderData }: Route.ComponentProps) {
  const { post, body, visibleTags, sidebarPosts, tags, detail, imageMeta } = loaderData
  return (
    <PostDetailBody
      post={post}
      headings={post.headings}
      visibleTags={visibleTags}
      admin={detail.admin}
      likes={detail.likes}
      commentKey={detail.commentKey}
      commentCsrfToken={detail.csrfToken}
      commentsPromise={detail.comments}
      currentUser={detail.currentUser}
      sidebar={{
        posts: sidebarPosts,
        tags,
        recentComments: detail.recentComments,
        pendingComments: detail.pendingComments,
      }}
    >
      <PortableTextBody body={body} headingSlugs={post.headings.map((h) => h.slug)} imageMeta={imageMeta} />
    </PostDetailBody>
  )
}
