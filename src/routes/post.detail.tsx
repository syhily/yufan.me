import { data } from 'react-router'

import type { DraftMarker } from '@/ui/public/post/DetailBodyChrome'

import { getTagsByNames, listAllTags } from '@/server/catalog/queries'
import { loadPostDraftPreviewBySlug } from '@/server/cms/posts/service'
import { resolveImageMetaBySources } from '@/server/images/render-enhance'
import { findPostBySlug, selectSidebarPosts } from '@/server/posts/query'
import { loadPublicDetailData, redirectPermanent, requireDetailSource } from '@/server/route-helpers/detail-loader'
import { ifNoneMatch, notModifiedResponse, weakEtag } from '@/server/route-helpers/etag'
import { canonicalPostPath } from '@/server/route-helpers/paths'
import { detailHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { bundleFromMatches, routeMeta, seoForPost } from '@/server/seo/meta'
import { tryGetSessionContext, resolveSessionContext } from '@/server/session'
import { selectSidebarTags } from '@/server/sidebar/select'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { toClientPost, toDetailPostShell } from '@/shared/catalog'
import { PortableTextBody } from '@/ui/pt/render'
import { PostDetailBody } from '@/ui/public/post/PostDetailBody'
import { PostFontLinks } from '@/ui/public/post/PostFontLinks'

import type { Route } from './+types/post.detail'

export const headers = detailHeaders
export const shouldRevalidate = publicShouldRevalidate

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const wantsDraftPreview = url.searchParams.get('draft') === 'true'

  const sourcePost = requireDetailSource((await findPostBySlug(params.slug)) ?? undefined)
  const clientPost = toClientPost(sourcePost)
  const canonical = canonicalPostPath(params.slug, clientPost.slug)
  if (canonical !== undefined) {
    redirectPermanent(canonical)
  }

  let draftBody = sourcePost.body
  let draftImageSources = sourcePost.imageSources
  let draftMarker: DraftMarker = null

  if (wantsDraftPreview) {
    const sessionCtx = tryGetSessionContext(context) ?? (await resolveSessionContext(request))
    if (sessionCtx.role === 'admin') {
      const preview = await loadPostDraftPreviewBySlug(params.slug)
      if (preview !== null) {
        if (preview.hasNewerDraft) {
          draftBody = preview.post.body
          draftImageSources = preview.post.imageSources
          draftMarker = 'unpublished-draft'
        } else {
          draftMarker = 'published-draft'
        }
      }
    }
  }

  const post = toDetailPostShell(clientPost)

  const etag = draftMarker === null ? weakEtag(['post', clientPost.id, post.updated]) : null
  if (etag !== null && ifNoneMatch(request, etag)) {
    throw notModifiedResponse(etag)
  }

  const [visibleTags, imageMeta, sidebarTags, sidebarPosts] = await Promise.all([
    getTagsByNames(post.tags),
    resolveImageMetaBySources(draftImageSources).then((r) => Object.fromEntries(r)),
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

  const headers: Record<string, string> = { 'Set-Cookie': commentCsrfSetCookie }
  if (etag !== null) {
    headers.ETag = etag
  }

  return data(
    {
      post,
      body: draftBody,
      visibleTags,
      sidebarPosts,
      tags: sidebarTags,
      detail,
      imageMeta,
      draftMarker,
    },
    { headers },
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
  const { post, body, visibleTags, sidebarPosts, tags, detail, imageMeta, draftMarker } = loaderData
  return (
    <>
      <PostFontLinks />
      <PostDetailBody
        post={post}
        headings={post.headings}
        draftMarker={draftMarker}
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
        }}
      >
        <PortableTextBody body={body} headingSlugs={post.headings.map((h) => h.slug)} imageMeta={imageMeta} />
      </PostDetailBody>
    </>
  )
}
