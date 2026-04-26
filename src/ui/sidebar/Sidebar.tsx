import { Link } from 'react-router'

import type { ClientTag, SidebarPostLink } from '@/server/catalog'
import type { LatestComment } from '@/server/comments/types'

import config from '@/blog.config'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { joinUrl } from '@/shared/urls'
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
    <aside className="sidebar col-12 col-xl-3 d-none d-xl-block">
      <div className="sidebar-inner block">
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
    <div id="pending-comments" className="widget widget-recent-comments">
      <WidgetTitle tooltip="云中谁寄锦书来？雁字回时，月满西楼。">待审评论</WidgetTitle>
      <ul>
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
  if (posts.length === 0) return null
  return (
    <div id="recent-posts" className="widget widget-recent-entries">
      <WidgetTitle tooltip="年年岁岁花相似，岁岁年年人不同。">流年拾忆</WidgetTitle>
      <ul className="line">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link to={post.permalink} title={post.title} prefetch="intent">
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
  if (config.settings.sidebar.comment <= 0 || comments.length === 0) return null

  return (
    <div id="recent-comments" className="widget widget-recent-comments">
      <WidgetTitle tooltip="欲寄彩笺兼尺素，山长水阔知何处？">雁过留声</WidgetTitle>
      <ul>
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
    <li className="recent-comments">
      <span className="comment-author-link">
        {authorHref === undefined ? (
          comment.author
        ) : (
          <a href={authorHref} target="_blank" rel="nofollow noreferrer">
            {comment.author}
          </a>
        )}
      </span>
      {' 发表在《'}
      <Link to={comment.permalink} prefetch="intent">
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
  if (tags.length === 0) return null

  return (
    <div id="tag-cloud" className="widget widget-tag-cloud">
      <WidgetTitle tooltip="流水落花春去也，天上人间。">文踪墨迹</WidgetTitle>
      <div className="tagcloud">
        {tags.map((tag) => (
          <Link
            key={tag.slug}
            to={tag.permalink}
            className="tag-cloud-link"
            title={`${tag.name} (${tag.counts} 篇文章)`}
            prefetch="intent"
          >
            {tag.name}
          </Link>
        ))}
      </div>
    </div>
  )
}

function WidgetTitle({ children, tooltip }: { children: string; tooltip: string }) {
  return (
    <Tooltip content={tooltip} placement="left">
      <div className="widget-title">{children}</div>
    </Tooltip>
  )
}

function TodayCalendar() {
  if (!config.settings.sidebar.calendar) return null
  const today = new Date()
  const calendarImage = joinUrl(
    config.website,
    'images/calendar',
    formatLocalDate(today, 'yyyy'),
    `${formatLocalDate(today, 'LLdd')}.png`,
  )
  return (
    <div className="widget widget-owspace-calendar">
      <WidgetTitle tooltip="时光只解催人老，不信多情，长恨离亭。">时光只言</WidgetTitle>
      <img loading="lazy" decoding="async" src={calendarImage} width={600} height={880} alt="今日日历" />
    </div>
  )
}
