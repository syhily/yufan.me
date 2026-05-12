import { data } from 'react-router'

import { getTagsByNames, listAllTags } from '@/server/catalog/queries'
import { resolveImageMetaBySources } from '@/server/images/render-enhance'
import { findPostBySlug, selectSidebarPosts } from '@/server/posts/query'
import { loadPublicDetailData, redirectPermanent, requireDetailSource } from '@/server/route-helpers/detail-loader'
import { ifNoneMatch, notModifiedResponse, weakEtag } from '@/server/route-helpers/etag'
import { canonicalPostPath } from '@/server/route-helpers/paths'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { bundleFromMatches, routeMeta, seoForPost } from '@/server/seo/meta'
import { selectSidebarTags } from '@/server/sidebar/select'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { toClientPost, toDetailPostShell } from '@/shared/catalog'
import { PostDetailBody } from '@/ui/post/post/PostDetailBody'
import { PortableTextBody } from '@/ui/pt/render'

import type { Route } from './+types/post.detail'

export const headers = detailHeaders
export const shouldRevalidate = publicShouldRevalidate

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const sourcePost = requireDetailSource((await findPostBySlug(params.slug)) ?? undefined)
  const clientPost = toClientPost(sourcePost)
  const canonical = canonicalPostPath(params.slug, clientPost.slug)
  if (canonical !== undefined) {
    redirectPermanent(canonical)
  }

  const post = toDetailPostShell(clientPost)

  const etag = weakEtag(['post', clientPost.id, post.updated])
  if (ifNoneMatch(request, etag)) {
    throw notModifiedResponse(etag)
  }

  const [visibleTags, imageMeta, sidebarTags, sidebarPosts] = await Promise.all([
    getTagsByNames(post.tags),
    resolveImageMetaBySources(sourcePost.imageSources).then((r) => Object.fromEntries(r)),
    listAllTags().then(selectSidebarTags),
    selectSidebarPosts(requireBlogSettingsSection('sidebar').sidebar.post),
  ])

  const { detail, commentCsrfSetCookie } = await loadPublicDetailData({
    request,
    context,
    target: { type: 'post', ownerId: BigInt(post.id) },
    preload: () => Promise.resolve(),
    sidebar: { posts: sidebarPosts, tags: sidebarTags },
  })

  return data(
    {
      post,
      body: sourcePost.body,
      visibleTags,
      sidebarPosts,
      tags: sidebarTags,
      detail,
      imageMeta,
    },
    { headers: { 'Set-Cookie': commentCsrfSetCookie, ETag: etag } },
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
