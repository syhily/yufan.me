import { getClientPostsWithMetadata, listClientPosts } from '@/server/posts/query'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { toListingPostCard } from '@/shared/catalog'
import { ArchivesBody } from '@/ui/post/archives/ArchivesBody'

import type { Route } from './+types/archives'

export async function loader(_: Route.LoaderArgs) {
  const listingNowIso = new Date().toISOString()
  const posts = (await listClientPosts({ includeHidden: true, includeScheduled: false })).map(toListingPostCard)
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
