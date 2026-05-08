import type { ClientTag, SidebarPostLink } from '@/shared/catalog'

import { selectSidebarPosts as querySidebarPosts } from '@/server/posts/query'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { sampleSize } from '@/shared/tools'

export async function selectSidebarPosts(count: number): Promise<SidebarPostLink[]> {
  return querySidebarPosts(count)
}

export function selectSidebarTags(tags: ClientTag[]): ClientTag[] {
  const randomSize = requireBlogSettingsSection('sidebar').sidebar.tag
  if (randomSize <= 0) {
    return []
  }
  const topTags = tags
    .slice()
    .sort((a, b) => b.counts - a.counts)
    .slice(0, randomSize * 2)
  if (topTags.length <= randomSize) {
    return topTags
  }

  return sampleSize(topTags, randomSize)
}
