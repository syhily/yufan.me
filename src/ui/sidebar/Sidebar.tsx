import { Link } from 'react-router'

import type { ClientTag, SidebarPostLink } from '@/server/catalog'
import type { LatestComment } from '@/server/comments/types'

import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { joinUrl } from '@/shared/urls'
import { useSiteConfig } from '@/ui/primitives/site-config'
import { Tooltip } from '@/ui/primitives/Tooltip'
import { SearchBar } from '@/ui/search/Search'

// Bundle of widgets the sidebar consumes. Grouping these in a single value
// means new widgets can be added without rippling a fresh prop into every
// loader call site (`HomeLayoutBody` / route loader / `Sidebar`).
export interface SidebarData {
  posts: SidebarPostLink[]
  tags: ClientTag[]
  recentComments: LatestComment[]
  pendingComments: LatestComment[]
}

export interface SidebarProps {
  data: SidebarData
  admin: boolean
}

export function Sidebar({ data, admin }: SidebarProps) {
  const { posts, tags, recentComments, pendingComments } = data

  return (
    <aside className="hidden w-full xl:block xl:w-1/4 xl:px-3">
      <div className="block py-8 px-7 bg-white xl:sticky xl:top-[30px]">
        <SearchBar />
        {admin && <PendingComments comments={pendingComments} />}
        <RandomPosts posts={posts} />
        <RecentComments comments={recentComments} />
        <RandomTags tags={tags} />
        <TodayCalendar />
      </div>
    </aside>
  )
}

interface PendingCommentsProps {
  comments: LatestComment[]
}

function PendingComments({ comments }: PendingCommentsProps) {
  return (
    <div id="pending-comments" className="mb-10">
      <WidgetTitle tooltip="云中谁寄锦书来？雁字回时，月满西楼。">待审评论</WidgetTitle>
      <ul className="pl-5">
        {comments.length > 0 ? (
          comments.map((comment) => <CommentLink key={commentKey(comment)} comment={comment} />)
        ) : (
          <div>无待审评论</div>
        )}
      </ul>
    </div>
  )
}

interface RandomPostsProps {
  posts: SidebarPostLink[]
}

function RandomPosts({ posts }: RandomPostsProps) {
  if (posts.length === 0) {
    return null
  }
  return (
    <div id="recent-posts" className="mb-10">
      <WidgetTitle tooltip="年年岁岁花相似，岁岁年年人不同。">流年拾忆</WidgetTitle>
      <ul className="pl-5">
        {posts.map((post) => (
          <li key={post.slug} className="mb-3 list-[circle] overflow-hidden whitespace-nowrap">
            <Link className="block hover:text-accent" to={post.permalink} title={post.title} prefetch="intent">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface RecentCommentsProps {
  comments: LatestComment[]
}

function RecentComments({ comments }: RecentCommentsProps) {
  const { settings } = useSiteConfig()
  if (settings.sidebar.comment <= 0 || comments.length === 0) {
    return null
  }

  return (
    <div id="recent-comments" className="mb-10">
      <WidgetTitle tooltip="欲寄彩笺兼尺素，山长水阔知何处？">雁过留声</WidgetTitle>
      <ul className="pl-5">
        {comments.map((comment) => (
          <CommentLink key={commentKey(comment)} comment={comment} />
        ))}
      </ul>
    </div>
  )
}

// `permalink` alone can collide when the same post receives multiple recent
// comments, so we combine it with author + title to make a stable key per row.
function commentKey(comment: LatestComment): string {
  return `${comment.permalink}|${comment.author}|${comment.title}`
}

function CommentLink({ comment }: { comment: LatestComment }) {
  const authorHref = safeHref(comment.authorLink)
  return (
    <li className="mb-3 list-[circle] overflow-hidden whitespace-nowrap">
      <span className="font-semibold text-foreground mr-[5px]">
        {authorHref === undefined ? (
          comment.author
        ) : (
          <a className="hover:text-accent" href={authorHref} target="_blank" rel="nofollow noreferrer">
            {comment.author}
          </a>
        )}
      </span>
      {' 发表在《'}
      <Link className="hover:text-accent" to={comment.permalink} prefetch="intent">
        {comment.title}
      </Link>
      》
    </li>
  )
}

interface RandomTagsProps {
  tags: ClientTag[]
}

function RandomTags({ tags }: RandomTagsProps) {
  if (tags.length === 0) {
    return null
  }

  return (
    <div id="tag-cloud" className="mb-10">
      <WidgetTitle tooltip="流水落花春去也，天上人间。">文踪墨迹</WidgetTitle>
      <div className="flex flex-wrap">
        {tags.map((tag) => (
          <Link
            key={tag.slug}
            to={tag.permalink}
            className="relative inline-block text-sm leading-none px-[0.9375rem] py-2 mr-[0.375rem] mb-[0.375rem] rounded-xs border border-border hover:text-accent"
            title={`${tag.name} (${tag.counts} 篇文章)`}
            prefetch="intent"
          >
            <span className="text-accent mr-[5px]">#</span>
            {tag.name}
          </Link>
        ))}
      </div>
    </div>
  )
}

function WidgetTitle({ children, tooltip }: { children: string; tooltip: string }) {
  return (
    <Tooltip placement="left">
      <Tooltip.Trigger as="div" className="relative text-accent text-base py-5 border-t-2 border-border-sidebar">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[2px] left-0 w-[30px] h-[2px] bg-accent"
        />
        <span className="relative">{children}</span>
      </Tooltip.Trigger>
      <Tooltip.Content>{tooltip}</Tooltip.Content>
    </Tooltip>
  )
}

function TodayCalendar() {
  const { website, settings } = useSiteConfig()
  if (!settings.sidebar.calendar) {
    return null
  }
  const today = new Date()
  const calendarImage = joinUrl(
    website,
    'images/calendar',
    formatLocalDate(today, 'yyyy'),
    `${formatLocalDate(today, 'LLdd')}.png`,
  )
  return (
    <div className="mb-10">
      <WidgetTitle tooltip="时光只解催人老，不信多情，长恨离亭。">时光只言</WidgetTitle>
      <img loading="lazy" decoding="async" src={calendarImage} width={600} height={880} alt="今日日历" />
    </div>
  )
}
