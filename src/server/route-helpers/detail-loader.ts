import type { LoaderFunctionArgs } from 'react-router'

import { redirect } from 'react-router'

import type { ClientPost, ClientTag } from '@/server/catalog'

import { type DetailPageComments, loadDetailPageStreaming } from '@/server/comments/page-data'
import { notFound } from '@/server/route-helpers/http'
import { getRouteRequestContext, issueCsrfToken } from '@/server/session'
import { selectSidebarPosts, selectSidebarTags } from '@/server/sidebar/select'

export type PublicDetailCritical = Awaited<ReturnType<typeof loadDetailPageStreaming>>['critical']

// `comments` rides as a Promise so the route can stream it through
// React Router's `<Await>` boundary while the critical body renders.
// (`react-router-framework-mode/data-loading` "Streaming with defer".)
export interface PublicDetailData extends PublicDetailCritical {
  comments: Promise<DetailPageComments>
  /** Double-submit CSRF token; pair with `csrf-token` cookie from the route `Set-Cookie` header. */
  csrfToken: string
}

export interface PublicDetailSidebarData {
  posts: ReturnType<typeof selectSidebarPosts>
  tags: ReturnType<typeof selectSidebarTags>
}

export function requireDetailSource<T>(source: T | undefined): T {
  if (source === undefined) {
    notFound()
  }
  return source
}

export function redirectPermanent(location: string): never {
  throw redirect(location, { status: 301 })
}

export async function loadPublicDetailData({
  request,
  context,
  permalink,
  title,
  preload,
  sidebar,
}: Pick<LoaderFunctionArgs, 'request' | 'context'> & {
  permalink: string
  title: string
  preload: () => Promise<void>
  sidebar?: {
    posts: ClientPost[]
    tags: ClientTag[]
  }
}): Promise<{
  detail: PublicDetailData
  sidebar?: PublicDetailSidebarData
  /** Use only as `data(..., { headers: { 'Set-Cookie': … } })` — omit from the client-visible loader object. */
  commentCsrfSetCookie: string
}> {
  const { session } = getRouteRequestContext({ request, context })
  const [, streaming, issued] = await Promise.all([
    preload(),
    loadDetailPageStreaming(session, permalink, title),
    issueCsrfToken(),
  ])

  return {
    detail: { ...streaming.critical, comments: streaming.comments, csrfToken: issued.token },
    sidebar:
      sidebar === undefined
        ? undefined
        : {
            posts: selectSidebarPosts(sidebar.posts),
            tags: selectSidebarTags(sidebar.tags),
          },
    commentCsrfSetCookie: issued.setCookie,
  }
}
