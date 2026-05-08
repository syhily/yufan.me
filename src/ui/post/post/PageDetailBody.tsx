import { type ReactNode, Suspense, useRef } from 'react'
import { Await } from 'react-router'

import type { CommentFormUser, DetailPageShell, MarkdownHeading } from '@/shared/catalog'
import type { DetailPageComments } from '@/shared/comments'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { Comments } from '@/ui/comments/Comments'
import { CommentsSkeleton } from '@/ui/comments/CommentsSkeleton'
import { cn } from '@/ui/lib/cn'
import { LikeButton } from '@/ui/like/LikeActions'
import { postTitleClass } from '@/ui/post/postChrome'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'
import { Footer } from '@/ui/primitives/Footer'
import { Image } from '@/ui/primitives/Image'

export interface PageDetailBodyProps {
  page: DetailPageShell
  headings: MarkdownHeading[]
  likes: number
  commentKey: string
  commentCsrfToken: string
  commentsPromise: Promise<DetailPageComments>
  currentUser?: CommentFormUser
  children: ReactNode
}

export function PageDetailBody({
  page,
  headings,
  likes,
  commentKey,
  commentCsrfToken,
  commentsPromise,
  currentUser,
  children,
}: PageDetailBodyProps) {
  const postContentRef = useRef<HTMLDivElement>(null)
  useMediumZoom(postContentRef)
  return (
    <div className="flex flex-wrap">
      <div className="box-border w-full max-w-full shrink-0 xl:w-2/3">
        <div className="post p-4 md:p-12">
          <h1 className={postTitleClass}>{page.title}</h1>
          <TableOfContents headings={headings} toc={page.toc} />
          <div className="mt-4 xl:mt-6">
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
          className="block size-full! object-cover"
        />
      </div>
    </div>
  )
}
