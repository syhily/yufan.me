import type { ReactNode } from 'react'

import type { SessionUser } from '@/services/auth/types'
import type { CommentItem, Comments as CommentsData } from '@/services/comments/types'

import config from '@/blog.config'
import { Comments } from '@/components/comment/Comments'
import { LikeButton } from '@/components/like/LikeButton'
import { TableOfContents } from '@/components/page/toc/TableOfContents'
import { Footer } from '@/components/partial/Footer'
import { type MarkdownHeading, type Page } from '@/services/catalog/schema'
import { joinUrl } from '@/shared/urls'

export interface PageDetailBodyProps {
  page: Page
  headings: MarkdownHeading[]
  likes: number
  commentData: CommentsData | null
  commentItems: CommentItem[]
  currentUser?: SessionUser
  children: ReactNode
}

export function PageDetailBody({
  page,
  headings,
  likes,
  commentData,
  commentItems,
  currentUser,
  children,
}: PageDetailBodyProps) {
  return (
    <div className="row gx-0">
      <div className="col-lg-8 col-xl-8">
        <div className="post p-3 p-md-5">
          <h1 className="post-title mb-3 mb-xl-4">{page.title}</h1>
          <TableOfContents headings={headings} toc={page.toc} />
          <div className="post-content">{children}</div>
          <LikeButton permalink={page.permalink} likes={likes} />
          {page.comments && (
            <Comments
              commentKey={joinUrl(config.website, page.permalink, '/')}
              comments={commentData}
              items={commentItems}
              user={currentUser}
            />
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
