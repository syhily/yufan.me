import type { ReactNode } from 'react'

import type { CommentFormUser, DetailPageShell, MarkdownHeading } from '@/server/catalog'
import type { CommentItem, Comments as CommentsData } from '@/server/comments/types'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { Comments } from '@/ui/comments/Comments'
import { LikeButton } from '@/ui/like/LikeActions'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'
import { Footer } from '@/ui/primitives/Footer'

export interface PageDetailBodyProps {
  page: DetailPageShell
  headings: MarkdownHeading[]
  likes: number
  commentKey: string
  commentData: CommentsData | null
  commentItems: CommentItem[]
  currentUser?: CommentFormUser
  children: ReactNode
}

export function PageDetailBody({
  page,
  headings,
  likes,
  commentKey,
  commentData,
  commentItems,
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
            <Comments commentKey={commentKey} comments={commentData} items={commentItems} user={currentUser} />
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
