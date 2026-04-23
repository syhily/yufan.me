import type { AstroSession } from 'astro'

import type { Post, Tag } from '@/services/catalog/schema'

import { AdminBlock } from '@/components/partial/AdminBlock'
import { SearchBar } from '@/components/search/SearchBar'
import { PendingComments } from '@/components/sidebar/PendingComments'
import { RandomPosts } from '@/components/sidebar/RandomPosts'
import { RandomTags } from '@/components/sidebar/RandomTags'
import { RecentComments } from '@/components/sidebar/RecentComments'
import { TodayCalendar } from '@/components/sidebar/TodayCalendar'

export interface SidebarProps {
  posts: Post[]
  tags: Tag[]
  session: AstroSession | undefined
}

export function Sidebar({ posts, tags, session }: SidebarProps) {
  return (
    <aside className="sidebar col-12 col-xl-3 d-none d-xl-block">
      <div className="sidebar-inner block">
        <SearchBar />
        <AdminBlock session={session}>
          <PendingComments />
        </AdminBlock>
        <RandomPosts posts={posts} />
        <RecentComments />
        <RandomTags tags={tags} />
        <TodayCalendar />
      </div>
    </aside>
  )
}
