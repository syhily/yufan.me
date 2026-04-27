import { clsx } from 'clsx'
import { type ReactNode, Suspense, use } from 'react'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'

import type { ClientTag, CommentFormUser, DetailPostShell, MarkdownHeading } from '@/server/catalog'
import type { DetailPageComments } from '@/server/comments/page-data'

import { useMediumZoom } from '@/client/hooks/use-medium-zoom'
import { formatLocalDate } from '@/shared/formatter'
import { Comments } from '@/ui/comments/Comments'
import { CommentsSkeleton } from '@/ui/comments/CommentsSkeleton'
import { LikeButton, LikeShare } from '@/ui/like/LikeActions'
import { TableOfContents } from '@/ui/post/toc/TableOfContents'
import { badgeVariants } from '@/ui/primitives/Badge'
import { Card, CardBody } from '@/ui/primitives/Card'
import { Container } from '@/ui/primitives/Container'
import { Heading } from '@/ui/primitives/Heading'
import { toneAttrs } from '@/ui/primitives/tone'
import { Sidebar, type SidebarData } from '@/ui/sidebar/Sidebar'

const DETAIL_SHELL_CLASS = 'py-4 md:py-6 lg:px-2 2xl:p-12'

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
    <div className={DETAIL_SHELL_CLASS}>
      <Container>
        <div className="flex flex-col xl:-mx-3 xl:flex-row">
          <div className="w-full xl:w-3/4 xl:px-3">
            <Card size="md">
              <CardBody size="md">
                <Heading level={1}>{post.title}</Heading>
                <div className="text-sm text-foreground-muted mt-3 mb-4 flex flex-col items-start gap-2.5 md:flex-row md:gap-y-3 md:gap-x-4">
                  <time className="flex-none leading-normal md:leading-7">
                    {formatLocalDate(post.date, 'yyyy-MM-dd HH:mm')}
                  </time>
                  {visibleTags.length > 0 && (
                    <div className="flex flex-auto flex-wrap w-full justify-start gap-y-2 gap-x-2.5 min-w-0 md:w-auto md:justify-end md:gap-2 md:ml-auto">
                      {visibleTags.map((tag) => (
                        <Link
                          key={tag.slug}
                          className={twMerge(
                            clsx(badgeVariants({ tone: 'neutral', shape: 'pill' }), 'leading-[1.2] whitespace-nowrap'),
                          )}
                          {...toneAttrs('neutral', 'solid')}
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
                <div className="prose-host text-[0.9375rem] leading-[1.875] [hyphens:auto] mb-6 font-serif">
                  {children}
                </div>
                <LikeButton permalink={post.permalink} likes={likes} />
                <LikeShare post={post} />
                {post.comments && (
                  <Suspense fallback={<CommentsSkeleton />}>
                    <DeferredComments promise={commentsPromise} commentKey={commentKey} currentUser={currentUser} />
                  </Suspense>
                )}
              </CardBody>
            </Card>
          </div>
          <Sidebar data={sidebar} admin={admin} />
        </div>
      </Container>
    </div>
  )
}

// React 19 `use()` wrapper. Exists in its own component because `use()` must
// run inside the component body that should suspend; reading the promise from
// the parent would suspend the entire `<PostDetailBody>` instead of just the
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
