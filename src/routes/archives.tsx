import { getCatalog, getClientPostsWithMetadata, toListingPostCard } from '@/server/catalog'
import { listingHeaders, listingShouldRevalidate } from '@/server/listing'
import { routeMeta } from '@/server/seo/meta'
import { ArchivesBody } from '@/ui/post/archives/ArchivesBody'
import { SectionErrorView } from '@/ui/primitives/SectionErrorView'

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
export const shouldRevalidate = listingShouldRevalidate

export function meta() {
  return routeMeta({ title: '归档' })
}

export default function ArchivesRoute({ loaderData }: Route.ComponentProps) {
  return <ArchivesBody resolvedPosts={loaderData.resolvedPosts} />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <SectionErrorView error={error} title="无法加载归档" />
}
