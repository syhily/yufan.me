import { PencilIcon } from 'lucide-react'
import { type ReactNode, Suspense, useRef } from 'react'
import { Await, Link } from 'react-router'

import type { ClientTag, CommentFormUser, DetailPostShell, MarkdownHeading } from '@/shared/catalog'
import type { DetailPageComments } from '@/shared/comments'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { formatLocalDate } from '@/shared/formatter'
import { Comments } from '@/ui/comments/Comments'
import { CommentsSkeleton } from '@/ui/comments/CommentsSkeleton'
import { useSiteIdentity } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'
import { LikeButton, LikeShare } from '@/ui/like/LikeActions'
import { postMetaClass, postMetaDateClass, postMetaTagsClass, postTitleClass } from '@/ui/post/postChrome'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'
import { Sidebar, type SidebarData } from '@/ui/sidebar/Sidebar'

export interface PostDetailBodyProps {
  post: DetailPostShell
  headings: MarkdownHeading[]
  visibleTags: ClientTag[]
  admin: boolean
  likes: number
  commentKey: string
  /** Public comment form CSRF (paired with `csrf-token` HttpOnly cookie). */
  commentCsrfToken: string
  /** Streamed in via React Router `<Await>`. */
  commentsPromise: Promise<DetailPageComments>
  currentUser?: CommentFormUser
  sidebar: SidebarData
  children: ReactNode
}

export function PostDetailBody({
  post,
  headings,
  visibleTags,
  admin,
  likes,
  commentKey,
  commentCsrfToken,
  commentsPromise,
  currentUser,
  sidebar,
  children,
}: PostDetailBodyProps) {
  const config = useSiteIdentity()
  const postContentRef = useRef<HTMLDivElement>(null)
  useMediumZoom(postContentRef)
  const publishedIso = post.date.toISOString()
  const updatedAt = post.updated ?? post.date
  const updatedIso = updatedAt.toISOString()
  return (
    <div className="py-4 md:py-6 lg:px-2 2xl:px-12 2xl:py-12">
      <div className="mx-auto w-full px-3 sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl">
        <div className="-mx-3 flex flex-wrap">
          <div className="box-border w-full max-w-full shrink-0 px-3 xl:w-[71%]">
            {/* Collapsed the historical two-layer DOM (outer
                `<div class="post flex flex-col …">` holding the card
                chrome, inner `<div class="flex-1 p-4 md:p-8">`
                holding the body padding) into a single wrapper since
                the bare `.post` class attaches no CSS rule. The
                inner wrapper's `flex-1` / `p-4 md:p-8` utilities
                migrated to the same element. */}
            <div className="relative mb-5 flex min-w-0 flex-col bg-canvas p-4 wrap-break-word shadow-card md:p-8">
              {admin && (
                <Link
                  to={`/wp-admin/posts/${post.id}/edit`}
                  className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink-strong md:top-4 md:right-4"
                  aria-label="编辑"
                  title="编辑"
                  prefetch="intent"
                >
                  <PencilIcon className="size-4" />
                </Link>
              )}
              <h1 className={cn(postTitleClass, 'font-bold')}>{post.title}</h1>
              <div className={cn(postMetaClass, 'mt-4 mb-3 text-sm text-ink-muted')}>
                <div className={cn(postMetaDateClass, 'flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1')}>
                  <time dateTime={publishedIso} className="tabular-nums">
                    {formatLocalDate(post.date, 'yyyy-MM-dd HH:mm', config)}
                  </time>
                  {post.showUpdated && (
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-1">
                      <span className="shrink-0">修改于</span>
                      <time dateTime={updatedIso} className="tabular-nums">
                        {formatLocalDate(updatedAt, 'yyyy-MM-dd HH:mm', config)}
                      </time>
                    </div>
                  )}
                </div>
                {visibleTags.length > 0 && (
                  <div className={postMetaTagsClass}>
                    {visibleTags.map((tag) => (
                      <Link
                        key={tag.slug}
                        className="rounded-full bg-surface-soft px-3 py-1.5 align-middle text-badge leading-badge font-normal whitespace-nowrap text-ink-secondary"
                        to={`/tags/${tag.slug}`}
                        prefetch="intent"
                      >
                        {tag.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <TableOfContents headings={headings} toc={post.toc} />
              {/* `post-content` is the compound suffix targeted by
                  `@utility prose-blog { &.post-content {…} }` in
                  `tailwind.css` for code-block / shiki / inline-code
                  typography fine-tuning on rendered MDX bodies. */}
              <div ref={postContentRef} className={cn('post-content', 'prose-blog prose prose-lg max-w-none')}>
                {children}
              </div>
              <LikeButton permalink={post.permalink} likes={likes} />
              <LikeShare post={post} />
              {post.comments && (
                <Suspense fallback={<CommentsSkeleton />}>
                  <Await resolve={commentsPromise}>
                    {(resolved) => (
                      <Comments
                        commentKey={commentKey}
                        csrfToken={commentCsrfToken}
                        comments={resolved.commentData}
                        items={resolved.commentItems}
                        user={currentUser}
                      />
                    )}
                  </Await>
                </Suspense>
              )}
            </div>
          </div>
          <Sidebar data={sidebar} admin={admin} />
        </div>
      </div>
    </div>
  )
}
