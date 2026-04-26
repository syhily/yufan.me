import { type ReactNode, Suspense } from 'react'
import { Await } from 'react-router'

import type { CommentFormUser, DetailPageShell, MarkdownHeading } from '@/server/catalog'
import type { DetailPageComments } from '@/server/comments/page-data'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { Comments } from '@/ui/comments/Comments'
import { CommentsSkeleton } from '@/ui/comments/CommentsSkeleton'
import { LikeButton } from '@/ui/like/LikeActions'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'
import { Footer } from '@/ui/primitives/Footer'

export interface PageDetailBodyProps {
  page: DetailPageShell
  headings: MarkdownHeading[]
  likes: number
  commentKey: string
  commentsPromise: Promise<DetailPageComments>
  currentUser?: CommentFormUser
  children: ReactNode
}

export function PageDetailBody({
  page,
  headings,
  likes,
  commentKey,
  commentsPromise,
  currentUser,
  children,
}: PageDetailBodyProps) {
  useMediumZoom()
  return (
    <div className="row gx-0">
      <div className="col-lg-8 col-xl-8">
        <div className="post p-3 p-md-5">
          <h1 className="post-title mb-3 mb-xl-4">{page.title}</h1>
          <TableOfContents headings={headings} toc={page.toc} />
          <div className="post-content">{children}</div>
          <LikeButton permalink={page.permalink} likes={likes} />
          {page.comments && (
            <Suspense fallback={<CommentsSkeleton />}>
              <Await resolve={commentsPromise}>
                {(resolved) => (
                  <Comments
                    commentKey={commentKey}
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
      <div className="col-lg-4 col-xl-4 d-none d-lg-block sticky-top hv">
        <div className="bg-img hv" style={{ backgroundImage: `url('${page.cover}')` }} />
      </div>
    </div>
  )
}
