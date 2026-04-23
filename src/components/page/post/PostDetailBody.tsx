import type { ReactNode } from 'react'

import type { SessionUser } from '@/services/auth/types'
import type { CommentItem, Comments as CommentsData, LatestComment } from '@/services/comments/types'

import config from '@/blog.config'
import { Comments } from '@/components/comment/Comments'
import { LikeButton } from '@/components/like/LikeButton'
import { LikeShare } from '@/components/like/LikeShare'
import { TableOfContents } from '@/components/page/toc/TableOfContents'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { type MarkdownHeading, type Post, type Tag } from '@/services/catalog/schema'
import { formatLocalDate } from '@/services/markdown/formatter'
import { joinUrl } from '@/shared/urls'

export interface PostDetailBodyProps {
  post: Post
  headings: MarkdownHeading[]
  visibleTags: Tag[]
  sidebarPosts: Post[]
  tags: Tag[]
  admin: boolean
  likes: number
  commentData: CommentsData | null
  commentItems: CommentItem[]
  currentUser?: SessionUser
  recentComments: LatestComment[]
  pendingComments: LatestComment[]
  children: ReactNode
}

export function PostDetailBody({
  post,
  headings,
  visibleTags,
  sidebarPosts,
  tags,
  admin,
  likes,
  commentData,
  commentItems,
  currentUser,
  recentComments,
  pendingComments,
  children,
}: PostDetailBodyProps) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <div className="container">
        <div className="row">
          <div className="content-wrapper col-12 col-xl-9">
            <div className="post card card-md">
              <div className="card-body">
                <h1 className="post-title">{post.title}</h1>
                <div className="post-meta text-sm text-muted mt-3 mb-4">
                  <time>{formatLocalDate(post.date, 'yyyy-MM-dd HH:mm')}</time>
                  {visibleTags.length > 0 &&
                    visibleTags.map((tag) => (
                      <a
                        key={tag.slug}
                        className="float-end ms-2 badge badge-light badge-pill"
                        href={`/tags/${tag.slug}`}
                      >
                        {tag.name}
                      </a>
                    ))}
                </div>
                <TableOfContents headings={headings} toc={post.toc} />
                <div className="post-content">{children}</div>
                <LikeButton permalink={post.permalink} likes={likes} />
                <LikeShare post={post} />
                {post.comments && (
                  <Comments
                    commentKey={joinUrl(config.website, post.permalink, '/')}
                    comments={commentData}
                    items={commentItems}
                    user={currentUser}
                  />
                )}
              </div>
            </div>
          </div>
          <Sidebar
            posts={sidebarPosts}
            tags={tags}
            admin={admin}
            recentComments={recentComments}
            pendingComments={pendingComments}
          />
        </div>
      </div>
    </div>
  )
}
