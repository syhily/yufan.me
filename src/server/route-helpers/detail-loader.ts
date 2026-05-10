import type { LoaderFunctionArgs } from 'react-router'

import { redirect } from 'react-router'

import type { ClientTag, SidebarPostLink } from '@/shared/catalog'

import { type DetailPageComments, loadDetailPageStreaming } from '@/server/comments/page-data'
import { notFound } from '@/server/route-helpers/http'
import { issueCsrfToken, resolveSessionContext, tryGetSessionContext } from '@/server/session'

export type PublicDetailCritical = Awaited<ReturnType<typeof loadDetailPageStreaming>>['critical']

// `comments` rides as a Promise so the route can stream it through
// React Router's `<Await>` boundary while the critical body renders.
// (`react-router-framework-mode/data-loading/data-loading` "Streaming with defer".)
export interface PublicDetailData extends PublicDetailCritical {
  comments: Promise<DetailPageComments>
  /** Double-submit CSRF token; pair with `csrf-token` cookie from the route `Set-Cookie` header. */
  csrfToken: string
}

export interface PublicDetailSidebarData {
  posts: SidebarPostLink[]
  tags: ClientTag[]
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

function isPrefetchRequest(request: Request): boolean {
  const purpose = request.headers.get('Purpose') ?? request.headers.get('Sec-Purpose')
  return purpose?.toLowerCase().includes('prefetch') ?? false
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
  sidebar?: PublicDetailSidebarData
}): Promise<{
  detail: PublicDetailData
  sidebar?: PublicDetailSidebarData
  /** Use only as `data(..., { headers: { 'Set-Cookie': … } })` — omit from the client-visible loader object. */
  commentCsrfSetCookie: string
}> {
  const sessionContext = tryGetSessionContext(context) ?? (await resolveSessionContext(request))
  const { session } = sessionContext
  const trackView = !isPrefetchRequest(request)
  const [, streaming, issued] = await Promise.all([
    preload(),
    loadDetailPageStreaming(session, permalink, title, { trackView }),
    issueCsrfToken(),
  ])

  return {
    detail: { ...streaming.critical, comments: streaming.comments, csrfToken: issued.token },
    sidebar,
    commentCsrfSetCookie: issued.setCookie,
  }
}
