import { getCatalog, getClientPostsWithMetadata, toListingPostCard } from '@/server/catalog'
import { listingHeaders, publicShouldRevalidate } from '@/server/route-helpers/route-exports'
import { routeMeta } from '@/server/seo/meta'
import { ArchivesBody } from '@/ui/post/archives/ArchivesBody'

import type { Route } from './+types/archives'

export async function loader(_: Route.LoaderArgs) {
  const catalog = await getCatalog()
  const posts = catalog.getClientPosts({ includeHidden: true, includeScheduled: false }).map(toListingPostCard)
  const resolvedPosts = await getClientPostsWithMetadata(posts, {
    likes: true,
    views: true,
    comments: false,
  })
  return {
    resolvedPosts,
  }
}

export const headers = listingHeaders
export const shouldRevalidate = publicShouldRevalidate

export function meta() {
  return routeMeta({ title: '归档' })
}

export default function ArchivesRoute({ loaderData }: Route.ComponentProps) {
  return <ArchivesBody resolvedPosts={loaderData.resolvedPosts} />
}
