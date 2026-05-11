import { PencilIcon } from 'lucide-react'
import { type ReactNode, Suspense } from 'react'
import { Await, Link } from 'react-router'

import type { SiteIdentitySettings } from '@/shared/blog-config-types'
import type { CommentFormUser, MarkdownHeading } from '@/shared/catalog'
import type { DetailPageComments } from '@/shared/comments'

import { formatLocalDate } from '@/shared/formatter'
import { Comments } from '@/ui/comments/Comments'
import { CommentsSkeleton } from '@/ui/comments/CommentsSkeleton'
import { cn } from '@/ui/lib/cn'
import { LikeButton } from '@/ui/like/LikeActions'
import { postMetaClass, postMetaDateClass, postTitleClass } from '@/ui/post/postChrome'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'

export type DraftMarker = 'draft' | 'unpublished-draft' | 'published-draft' | null

const DRAFT_MARKER_LABELS: Record<Exclude<DraftMarker, null>, { sr: string; visible: string }> = {
  draft: { sr: '未发布草稿：', visible: '【草稿】' },
  'unpublished-draft': { sr: '未发布的草稿：', visible: '【未发布的草稿】' },
  'published-draft': { sr: '已发布的草稿：', visible: '【已发布的草稿】' },
}

export interface DetailBodyChromeProps {
  siteIdentity: SiteIdentitySettings
  title: string
  date: Date
  updated?: Date | null
  showUpdated: boolean
  headings: MarkdownHeading[]
  toc: boolean
  likes: number
  permalink: string
  commentKey: string
  commentCsrfToken: string
  commentsPromise: Promise<DetailPageComments>
  currentUser?: CommentFormUser
  commentsEnabled: boolean
  admin?: boolean
  editHref?: string
  draftMarker?: DraftMarker
  metaExtra?: ReactNode
  afterLikeButton?: ReactNode
  children: ReactNode
  postContentRef: React.RefObject<HTMLDivElement | null>
  contentWrapperClassName?: string
  metaClassName?: string
}

export function DetailBodyChrome({
  siteIdentity,
  title,
  date,
  updated,
  showUpdated,
  headings,
  toc,
  likes,
  permalink,
  commentKey,
  commentCsrfToken,
  commentsPromise,
  currentUser,
  commentsEnabled,
  admin,
  editHref,
  draftMarker = null,
  metaExtra,
  afterLikeButton,
  children,
  postContentRef,
  contentWrapperClassName,
  metaClassName,
}: DetailBodyChromeProps) {
  const markerLabel = draftMarker !== null ? DRAFT_MARKER_LABELS[draftMarker] : null
  const publishedIso = date.toISOString()
  const updatedAt = updated ?? date
  const updatedIso = updatedAt.toISOString()

  return (
    <>
      {admin && editHref && (
        <Link
          to={editHref}
          className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink-strong md:top-4 md:right-4"
          aria-label="编辑"
          title="编辑"
          prefetch="intent"
        >
          <PencilIcon className="size-4" />
        </Link>
      )}
      <h1 className={cn(postTitleClass, 'font-bold')}>
        {markerLabel !== null && (
          <span className="text-alert">
            <span className="sr-only">{markerLabel.sr}</span>
            {markerLabel.visible}
          </span>
        )}
        {title}
      </h1>
      <div className={cn(postMetaClass, 'text-sm text-ink-muted', metaClassName)}>
        <div className={cn(postMetaDateClass, 'flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1')}>
          <time dateTime={publishedIso} className="tabular-nums">
            {formatLocalDate(date, 'yyyy-MM-dd HH:mm', siteIdentity)}
          </time>
          {showUpdated && (
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1">
              <span className="shrink-0">修改于</span>
              <time dateTime={updatedIso} className="tabular-nums">
                {formatLocalDate(updatedAt, 'yyyy-MM-dd HH:mm', siteIdentity)}
              </time>
            </div>
          )}
        </div>
        {metaExtra}
      </div>
      <TableOfContents headings={headings} toc={toc} />
      <div className={contentWrapperClassName}>
        {/* `post-content` is the compound suffix targeted by
            `@utility prose-blog { &.post-content {…} }` in
            `tailwind.css` for code-block / shiki / inline-code
            typography fine-tuning on rendered MDX bodies. */}
        <div ref={postContentRef} className={cn('post-content', 'prose-blog prose prose-lg max-w-none')}>
          {children}
        </div>
      </div>
      <LikeButton permalink={permalink} likes={likes} />
      {afterLikeButton}
      {commentsEnabled && (
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
    </>
  )
}
