import type { ReactNode } from 'react'

import { Link } from 'react-router'

import type { ListingPostCard, ListingPostCardWithMetadata } from '@/server/catalog'

import { formatShowDate } from '@/shared/formatter'
import { CommentIcon, EyeIcon, HeartFillIcon } from '@/ui/icons/icons'
import { Pagination } from '@/ui/post/pagination/Pagination'
import { Image } from '@/ui/primitives/Image'
import { Sidebar, type SidebarData } from '@/ui/sidebar/Sidebar'

export interface HomeLayoutBodyProps {
  resolvedPosts: ListingPostCardWithMetadata[]
  pageNum: number
  totalPage: number
  categoryLinks: Record<string, string>
  featurePosts: ListingPostCard[]
  admin: boolean
  sidebar: SidebarData
  children?: ReactNode
}

export function HomeLayoutBody({
  resolvedPosts,
  pageNum,
  totalPage,
  categoryLinks,
  featurePosts,
  admin,
  sidebar,
  children,
}: HomeLayoutBodyProps) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      {pageNum === 1 && <FeaturePosts posts={featurePosts} />}
      <div className="container">
        <div className="row">
          <PostCards pageNum={pageNum} posts={resolvedPosts} totalPage={totalPage} categoryLinks={categoryLinks} />
          <Sidebar data={sidebar} admin={admin} />
        </div>
      </div>
      {children}
    </div>
  )
}

export interface PostListingBodyProps {
  title: string
  description?: string
  resolvedPosts: ListingPostCardWithMetadata[]
  pageNum: number
  totalPage: number
  rootPath: string
  alwaysRenderPagination?: boolean
}

export function PostListingBody({
  title,
  description,
  resolvedPosts,
  pageNum,
  totalPage,
  rootPath,
  alwaysRenderPagination = true,
}: PostListingBodyProps) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <div className="container">
        <div className="mb-3 mb-lg-4">
          <h1>{title}</h1>
          {description && (
            <div className="text-muted mt-1">
              <span dangerouslySetInnerHTML={{ __html: description }} />
            </div>
          )}
        </div>
        {resolvedPosts.length === 0 ? (
          <div className="data-null">
            <div className="my-auto">
              <h1 className="font-number">404</h1>
              <div>抱歉，没有你要找的内容...</div>
            </div>
          </div>
        ) : (
          <>
            <div className="row g-2 g-md-3 g-xxl-4 list-grouped">
              {resolvedPosts.map((post, index) => (
                <PostSquare key={post.slug} post={post} first={index === 0} />
              ))}
            </div>
            {(alwaysRenderPagination || totalPage > 1) && (
              <div className="mt-4 mt-lg-5">
                <Pagination current={pageNum} total={totalPage} rootPath={rootPath} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface FeaturePostsProps {
  posts: ListingPostCard[]
}

function FeaturePosts({ posts }: FeaturePostsProps) {
  if (posts.length !== 3) return null
  return (
    <div className="list-top-pushes mb-3 mb-md-4 mb-lg-5">
      <div className="container">
        <div className="row gx-2 gx-md-3 list-grouped">
          <div className="col-lg-8">
            <FeaturePost post={posts[0]} />
          </div>
          <div className="col-lg-4 d-flex flex-column mt-2 mt-md-3 mt-lg-0">
            <div className="row g-2 g-md-3">
              <div className="col-6 col-lg-12">
                <FeaturePost post={posts[1]} />
              </div>
              <div className="col-6 col-lg-12">
                <FeaturePost post={posts[2]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeaturePost({ post }: { post: ListingPostCard }) {
  return (
    <div className="list-item list-nice-overlay">
      <div className="media media-3x2">
        <Link to={post.permalink} className="media-content" prefetch="intent">
          <Image src={post.cover} alt={post.title} width={750} height={500} thumbhash={post.coverThumbhash} />
          <div className="overlay" />
        </Link>
      </div>
      <div className="list-content p-2 p-md-3">
        <div className="list-body">
          <Link to={post.permalink} className="list-title h5 h-2x m-0" prefetch="intent">
            {post.title}
          </Link>
        </div>
      </div>
    </div>
  )
}

export interface PostCardsProps {
  posts: ListingPostCardWithMetadata[]
  pageNum: number
  totalPage: number
  categoryLinks: Record<string, string>
}

export function PostCards({ pageNum, posts, totalPage, categoryLinks }: PostCardsProps) {
  return (
    <div className="content-wrapper col-12 col-xl-9">
      <div className="list-grid">
        {posts.map((post) => (
          <div key={post.slug} className="list-item block">
            <div className="media media-3x2 col-6 col-md-5">
              <Link to={post.permalink} className="media-content" prefetch="intent">
                <Image src={post.cover} alt={post.title} width={600} height={400} thumbhash={post.coverThumbhash} />
              </Link>
              <div className="media-overlay overlay-top">
                <Link
                  className="d-none d-md-inline-block badge badge-md bg-white-overlay"
                  to={categoryLinks[post.category] || '/'}
                  prefetch="intent"
                >
                  {post.category}
                </Link>
              </div>
            </div>
            <div className="list-content">
              <div className="list-body">
                <Link to={post.permalink} className="list-title h5" prefetch="intent">
                  <div className="h-2x">
                    {!post.published && <span style={{ color: 'var(--color-danger)' }}>【草稿】</span>}
                    {post.title}
                  </div>
                </Link>
                <div className="d-none d-md-block list-desc text-secondary text-md mt-3">
                  <div className="h-3x">{post.summary ?? ''}</div>
                </div>
              </div>
              <div className="list-footer">
                <div className="d-flex flex-fill align-items-center text-muted text-sm">
                  <div className="flex-fill d-none d-md-block">{formatShowDate(post.date)}</div>
                  <ListMetric value={post.meta.views}>
                    <EyeIcon className="text-md" />
                  </ListMetric>
                  <ListMetric value={post.meta.likes}>
                    <HeartFillIcon className="text-md" />
                  </ListMetric>
                  <ListMetric value={post.meta.comments}>
                    <CommentIcon className="text-md" />
                  </ListMetric>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination current={pageNum} total={totalPage} rootPath="/" />
    </div>
  )
}

function ListMetric({ children, value }: { children: ReactNode; value: number }) {
  return (
    <div className="list-like d-inline-block">
      {children}
      <span className="like-count">{value}</span>
    </div>
  )
}

export interface PostSquareProps {
  post: ListingPostCardWithMetadata
  first: boolean
}

export function PostSquare({ post, first }: PostSquareProps) {
  return (
    <div className={first ? 'col-12 col-md-8 col-xl-6' : 'col-6 col-md-4 col-xl-3'}>
      <div className="list-item list-nice-overlay">
        <div className={`media ${first ? 'media-36x17' : ''}`}>
          <Link to={post.permalink} className="media-content" prefetch="intent">
            <Image
              src={post.cover}
              alt={post.title}
              width={first ? 600 : 300}
              height={300}
              thumbhash={post.coverThumbhash}
            />
            <div className="overlay" />
          </Link>
        </div>
        <div className="list-content">
          <Link to={post.permalink} className="list-body" prefetch="intent">
            <div className="list-title h6 h-2x">{post.title}</div>
            <div className="list-meta font-number d-flex flex-fill text-muted text-sm">
              <span className="d-inline-block">{formatShowDate(post.date)}</span>
              <div className="flex-fill" />
              <SquareMetric value={post.meta.views}>
                <EyeIcon className="text-md" />
              </SquareMetric>
              <SquareMetric value={post.meta.likes}>
                <HeartFillIcon className="text-md" />
              </SquareMetric>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

function SquareMetric({ children, value }: { children: ReactNode; value: number }) {
  return (
    <div className="list-like-square d-inline-block">
      {children}
      <span className="like-count">{value}</span>
    </div>
  )
}
