import { type ReactNode, Suspense } from 'react'
import { Await, Link } from 'react-router'

import type { ClientTag, CommentFormUser, DetailPostShell, MarkdownHeading } from '@/server/catalog'
import type { DetailPageComments } from '@/server/comments/page-data'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { formatLocalDate } from '@/shared/formatter'
import { Comments } from '@/ui/comments/Comments'
import { CommentsSkeleton } from '@/ui/comments/CommentsSkeleton'
import { LikeButton, LikeShare } from '@/ui/like/LikeActions'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'
import { Sidebar, type SidebarData } from '@/ui/sidebar/Sidebar'

export interface PostDetailBodyProps {
  post: DetailPostShell
  headings: MarkdownHeading[]
  visibleTags: ClientTag[]
  admin: boolean
  likes: number
  commentKey: string
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
  commentsPromise,
  currentUser,
  sidebar,
  children,
}: PostDetailBodyProps) {
  useMediumZoom()
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <div className="container">
        <div className="row">
          <div className="content-wrapper col-12 col-xl-9">
            <div className="post card card-md">
              <div className="card-body">
                <h1 className="post-title">{post.title}</h1>
                <div className="post-meta text-sm text-muted mt-3 mb-4">
                  <time className="post-meta-date">{formatLocalDate(post.date, 'yyyy-MM-dd HH:mm')}</time>
                  {visibleTags.length > 0 && (
                    <div className="post-meta-tags">
                      {visibleTags.map((tag) => (
                        <Link
                          key={tag.slug}
                          className="badge badge-light badge-pill"
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
                <div className="post-content">{children}</div>
                <LikeButton permalink={post.permalink} likes={likes} />
                <LikeShare post={post} />
                {post.comments && (
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
            </div>
          </div>
          <Sidebar data={sidebar} admin={admin} />
        </div>
      </div>
    </div>
  )
}
