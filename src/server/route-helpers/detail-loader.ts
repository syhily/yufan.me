import type { LoaderFunctionArgs } from 'react-router'

import { redirect } from 'react-router'

import type { ClientPost, ClientTag } from '@/server/catalog'

import { type DetailPageComments, loadDetailPageStreaming } from '@/server/comments/page-data'
import { notFound } from '@/server/route-helpers/http'
import { getRouteRequestContext } from '@/server/session'
import { selectSidebarPosts, selectSidebarTags } from '@/server/sidebar/select'

export type PublicDetailCritical = Awaited<ReturnType<typeof loadDetailPageStreaming>>['critical']

// `comments` rides as a Promise so the route can stream it through
// React Router's `<Await>` boundary while the critical body renders.
// (`react-router-framework-mode/data-loading` "Streaming with defer".)
export interface PublicDetailData extends PublicDetailCritical {
  comments: Promise<DetailPageComments>
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
}): Promise<{ detail: PublicDetailData; sidebar?: PublicDetailSidebarData }> {
  const { session } = getRouteRequestContext({ request, context })
  const [, streaming] = await Promise.all([preload(), loadDetailPageStreaming(session, permalink, title)])

  return {
    detail: { ...streaming.critical, comments: streaming.comments },
    sidebar:
      sidebar === undefined
        ? undefined
        : {
            posts: selectSidebarPosts(sidebar.posts),
            tags: selectSidebarTags(sidebar.tags),
          },
  }
}
