import type { ClientTag, SidebarPostLink } from '@/shared/types/catalog'

import { selectSidebarPosts as querySidebarPosts } from '@/server/content/posts/query'
import { requireBlogSettingsSection } from '@/shared/config/blog'
import { sampleSize } from '@/shared/utils/tools'

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
