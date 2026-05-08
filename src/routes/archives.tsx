import { getClientPostsWithMetadata, listClientPosts } from '@/server/content/posts/query'
import { listingHeaders, publicShouldRevalidate } from '@/server/present/router/route-exports'
import { bundleFromMatches, routeMeta } from '@/server/present/seo/meta'
import { toListingPostCard } from '@/shared/types/catalog'
import { ArchivesBody } from '@/ui/public/post/ArchivesBody'

import type { Route } from './+types/archives'

export async function loader(_: Route.LoaderArgs) {
  const listingNowIso = new Date().toISOString()
  const rawPosts = await listClientPosts({ includeHidden: true, includeScheduled: false })
  const posts = rawPosts.map(toListingPostCard)
  const resolvedPosts = await getClientPostsWithMetadata(posts, {
    likes: true,
    views: true,
    comments: false,
  })
  return {
    resolvedPosts,
    listingNowIso,
  }
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '归档' }, bundleFromMatches(matches))
}

export default function ArchivesRoute({ loaderData }: Route.ComponentProps) {
  return <ArchivesBody resolvedPosts={loaderData.resolvedPosts} listingNowIso={loaderData.listingNowIso} />
}
