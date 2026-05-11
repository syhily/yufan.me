import { PencilIcon } from 'lucide-react'
import { type ReactNode, Suspense, useRef } from 'react'
import { Await, Link } from 'react-router'

import type { CommentFormUser, DetailPageShell, MarkdownHeading } from '@/shared/catalog'
import type { DetailPageComments } from '@/shared/comments'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { formatLocalDate } from '@/shared/formatter'
import { Comments } from '@/ui/comments/Comments'
import { CommentsSkeleton } from '@/ui/comments/CommentsSkeleton'
import { useSiteIdentity } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'
import { LikeButton } from '@/ui/like/LikeActions'
import { postMetaClass, postMetaDateClass, postTitleClass } from '@/ui/post/postChrome'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'
import { Footer } from '@/ui/primitives/Footer'
import { Image } from '@/ui/primitives/Image'

/**
 * Discriminator for the on-title admin-preview badge painted next to
 * the page title. Resolved entirely in the page-detail loader; the
 * UI just maps each value to its red label.
 *
 *   - `'draft'`              — page is not publicly live; admin sees the
 *                              latest draft (or last-known-good
 *                              published revision when there's no draft
 *                              yet). Anonymous visitors 404 on the same
 *                              URL.
 *   - `'unpublished-draft'`  — page IS publicly live; admin opened it
 *                              with `?draft=true` and a newer draft
 *                              exists on top of the published revision.
 *                              Body shown is the draft.
 *   - `'published-draft'`    — page IS publicly live; admin opened it
 *                              with `?draft=true` but no newer draft
 *                              exists, so the body shown is just the
 *                              published revision (badge confirms it).
 */
export type DraftMarker = 'draft' | 'unpublished-draft' | 'published-draft' | null

const DRAFT_MARKER_LABELS: Record<Exclude<DraftMarker, null>, { sr: string; visible: string }> = {
  draft: { sr: '未发布草稿：', visible: '【草稿】' },
  'unpublished-draft': { sr: '未发布的草稿：', visible: '【未发布的草稿】' },
  'published-draft': { sr: '已发布的草稿：', visible: '【已发布的草稿】' },
}

export interface PageDetailBodyProps {
  page: DetailPageShell
  headings: MarkdownHeading[]
  /**
   * Admin-preview badge state. `null` (or omitted) for the standard
   * public render. See `DraftMarker` above for the three preview
   * cases the page-detail route distinguishes.
   */
  draftMarker?: DraftMarker
  likes: number
  commentKey: string
  commentCsrfToken: string
  commentsPromise: Promise<DetailPageComments>
  currentUser?: CommentFormUser
  admin?: boolean
  children: ReactNode
}

export function PageDetailBody({
  page,
  headings,
  draftMarker = null,
  likes,
  commentKey,
  commentCsrfToken,
  commentsPromise,
  currentUser,
  admin,
  children,
}: PageDetailBodyProps) {
  const config = useSiteIdentity()
  const markerLabel = draftMarker !== null ? DRAFT_MARKER_LABELS[draftMarker] : null
  const postContentRef = useRef<HTMLDivElement>(null)
  useMediumZoom(postContentRef)
  const publishedIso = page.date.toISOString()
  const updatedAt = page.updated ?? page.date
  const updatedIso = updatedAt.toISOString()
  return (
    <div className="flex flex-wrap">
      <div className="box-border w-full max-w-full shrink-0 xl:w-2/3">
        <div className="relative p-4 md:p-12">
          {admin && (
            <Link
              to={`/wp-admin/pages/${page.id}/edit`}
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
            {page.title}
          </h1>
          <div className={cn(postMetaClass, 'mt-3 mb-4 text-sm text-ink-muted')}>
            <div className={cn(postMetaDateClass, 'flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1')}>
              <time dateTime={publishedIso} className="tabular-nums">
                {formatLocalDate(page.date, 'yyyy-MM-dd HH:mm', config)}
              </time>
              {page.showUpdated && (
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1">
                  <span className="shrink-0">修改于</span>
                  <time dateTime={updatedIso} className="tabular-nums">
                    {formatLocalDate(updatedAt, 'yyyy-MM-dd HH:mm', config)}
                  </time>
                </div>
              )}
            </div>
          </div>
          <TableOfContents headings={headings} toc={page.toc} />
          <div className="mt-4 xl:mt-6">
            {/* `post-content` is the compound suffix targeted by
                `@utility prose-blog { &.post-content {…} }` in
                `tailwind.css` for code-block / shiki / inline-code
                typography fine-tuning on rendered MDX bodies. */}
            <div ref={postContentRef} className={cn('post-content', 'prose-blog prose prose-lg max-w-none')}>
              {children}
            </div>
          </div>
          <LikeButton permalink={page.permalink} likes={likes} />
          {page.comments && (
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
        <Footer />
      </div>
      <div className="sticky top-0 z-1020 box-border hidden h-screen w-full max-w-full shrink-0 xl:block xl:w-1/3">
        <Image
          src={page.cover}
          alt={page.title}
          width={page.coverWidth ?? 800}
          height={page.coverHeight ?? 1200}
          thumbhash={page.coverThumbhash}
          loading="eager"
          className="block size-full object-cover"
        />
      </div>
    </div>
  )
}
