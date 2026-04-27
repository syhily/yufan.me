import { type ReactNode, Suspense, use } from 'react'

import type { CommentFormUser, DetailPageShell, MarkdownHeading } from '@/server/catalog'
import type { DetailPageComments } from '@/server/comments/page-data'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { Comments } from '@/ui/comments/Comments'
import { CommentsSkeleton } from '@/ui/comments/CommentsSkeleton'
import { LikeButton } from '@/ui/like/LikeActions'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'
import { Footer } from '@/ui/primitives/Footer'
import { Heading } from '@/ui/primitives/Heading'

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
    <div className="grid grid-cols-1 gap-x-0 lg:grid-cols-[2fr_1fr]">
      <div className="min-w-0">
        <div className="post p-3 md:p-5">
          <Heading level={1} className="mb-3 xl:mb-4">
            {page.title}
          </Heading>
          <TableOfContents headings={headings} toc={page.toc} />
          <div className="prose-host text-md leading-[1.875] [hyphens:auto] mb-6 font-serif">{children}</div>
          <LikeButton permalink={page.permalink} likes={likes} />
          {page.comments && (
            <Suspense fallback={<CommentsSkeleton />}>
              <DeferredComments promise={commentsPromise} commentKey={commentKey} currentUser={currentUser} />
            </Suspense>
          )}
        </div>
        <Footer />
      </div>
      <div className="hidden min-w-0 lg:block sticky top-0 z-10 h-screen">
        <div className="bg-img h-screen" style={{ backgroundImage: `url('${page.cover}')` }} />
      </div>
    </div>
  )
}

// React 19 `use()` wrapper. Exists in its own component because `use()` must
// run inside the component body that should suspend; reading the promise from
// the parent would suspend the entire `<PageDetailBody>` instead of just the
// comment slot under `<Suspense>`. Replaces the previous render-prop
// `<Await resolve={…}>` callback.
interface DeferredCommentsProps {
  promise: Promise<DetailPageComments>
  commentKey: string
  currentUser?: CommentFormUser
}

function DeferredComments({ promise, commentKey, currentUser }: DeferredCommentsProps) {
  const resolved = use(promise)
  return (
    <Comments
      commentKey={commentKey}
      comments={resolved.commentData}
      items={resolved.commentItems}
      user={currentUser}
    />
  )
}
