import type { ReactNode } from 'react'

import { clsx } from 'clsx'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'

import type { ListingPostCard, ListingPostCardWithMetadata } from '@/server/catalog'
import type { IconComponent } from '@/ui/icons/icons'

import { formatShowDate } from '@/shared/formatter'
import { CommentIcon, EyeIcon, HeartIcon } from '@/ui/icons/icons'
import { Pagination } from '@/ui/post/pagination/Pagination'
import { badgeVariants } from '@/ui/primitives/Badge'
import { Container } from '@/ui/primitives/Container'
import { Heading } from '@/ui/primitives/Heading'
import { Image } from '@/ui/primitives/Image'
import { Media, MediaOverlay } from '@/ui/primitives/Media'
import { MediaCover } from '@/ui/primitives/MediaCover'
import { Sidebar, type SidebarData } from '@/ui/sidebar/Sidebar'

const LISTING_SHELL_CLASS = 'py-4 md:py-6 lg:px-2 2xl:p-12'

const HOVER_OVERLAY_CLASS =
  'w-full h-full bg-[rgb(40_49_73/0.66)] absolute opacity-60 top-0 left-0 transition-opacity duration-300 ease-in-out'

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
    <div className={LISTING_SHELL_CLASS}>
      {pageNum === 1 && <FeaturePosts posts={featurePosts} />}
      <Container>
        <div className="flex flex-col xl:-mx-3 xl:flex-row">
          <PostCards pageNum={pageNum} posts={resolvedPosts} totalPage={totalPage} categoryLinks={categoryLinks} />
          <Sidebar data={sidebar} admin={admin} />
        </div>
      </Container>
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
    <div className={LISTING_SHELL_CLASS}>
      <Container>
        <div className="mb-4 lg:mb-6">
          <Heading level={1}>{title}</Heading>
          {description && (
            <div className="text-foreground-muted mt-1">
              <span dangerouslySetInnerHTML={{ __html: description }} />
            </div>
          )}
        </div>
        {resolvedPosts.length === 0 ? (
          <div className="flex h-[50vh] flex-1 flex-col text-center">
            <div className="my-auto">
              <h2 className="text-[6rem] font-semibold leading-tight text-foreground">404</h2>
              <div>抱歉，没有你要找的内容...</div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-4 2xl:gap-4">
              {resolvedPosts.map((post, index) => (
                <PostSquare key={post.slug} post={post} first={index === 0} />
              ))}
            </div>
            {(alwaysRenderPagination || totalPage > 1) && (
              <div className="mt-4 lg:mt-5">
                <Pagination current={pageNum} total={totalPage} rootPath={rootPath} />
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  )
}

interface FeaturePostsProps {
  posts: ListingPostCard[]
}

function FeaturePosts({ posts }: FeaturePostsProps) {
  if (posts.length !== 3) {
    return null
  }
  return (
    <div className="mb-4 md:mb-6 lg:mb-12">
      <Container>
        <div className="grid grid-cols-1 gap-x-2 gap-y-2 md:gap-x-4 md:gap-y-4 lg:grid-cols-[2fr_1fr] lg:gap-y-0">
          <div className="min-w-0">
            <FeaturePost post={posts[0]} />
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 md:gap-4 lg:grid-cols-1 lg:gap-2 lg:gap-y-4 mt-2 md:mt-4 lg:mt-0">
            <FeaturePost post={posts[1]} />
            <FeaturePost post={posts[2]} />
          </div>
        </div>
      </Container>
    </div>
  )
}

function FeaturePost({ post }: { post: ListingPostCard }) {
  return (
    <div className="relative flex flex-col min-w-0 break-words mb-0 flex-auto">
      <Media ratio="3x2" className="flex-auto">
        <MediaCover as={Link} to={post.permalink} hover prefetch="intent">
          <Image src={post.cover} alt={post.title} width={750} height={500} thumbhash={post.coverThumbhash} />
          <div className={`${HOVER_OVERLAY_CLASS} group-hover:opacity-[0.22]`} />
        </MediaCover>
      </Media>
      <div className="absolute right-0 bottom-0 left-0 z-(--z-card-overlay-1) p-2 md:p-3">
        <div className="flex flex-col flex-none">
          <Link
            to={post.permalink}
            className="line-clamp-2 m-0 block mb-2 text-[1.25rem] font-semibold text-white hover:text-foreground-on-dark"
            prefetch="intent"
          >
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
    <div className="w-full xl:w-3/4 xl:px-3">
      <div>
        {posts.map((post) => (
          <div
            key={post.slug}
            className="relative flex flex-row flex-auto min-w-0 break-words mb-3 md:mb-5 2xl:mb-7 border-0 rounded-none bg-white shadow-[0_0_30px_0_rgb(40_49_73/0.02)]"
          >
            <Media ratio="3x2" className="w-[45%] md:w-5/12">
              <MediaCover as={Link} to={post.permalink} prefetch="intent">
                <Image src={post.cover} alt={post.title} width={600} height={400} thumbhash={post.coverThumbhash} />
              </MediaCover>
              <MediaOverlay top>
                {/*
                 * The cover-image category overlay has its own translucent
                 * surface (`bg-white-overlay`) and intentionally bypasses
                 * the project tone palette — we only borrow the `size: 'md'`
                 * layout dimensions from `badgeVariants`. No `data-tone`
                 * attribute is emitted so `toneStyles.css` doesn't paint a
                 * border over the overlay.
                 */}
                <Link
                  className={twMerge(
                    clsx('hidden md:inline-block', badgeVariants({ size: 'md' }), 'border-0 bg-white-overlay'),
                  )}
                  to={categoryLinks[post.category] || '/'}
                  prefetch="intent"
                >
                  {post.category}
                </Link>
              </MediaOverlay>
            </Media>
            <div className="flex flex-col flex-auto justify-center bg-white p-3 pb-2 md:px-5 md:py-5 md:pb-4 2xl:p-6">
              <div className="flex-auto">
                <Link
                  to={post.permalink}
                  className="block text-[1.25rem] font-semibold text-inherit hover:text-accent"
                  prefetch="intent"
                >
                  <div className="line-clamp-2">
                    {!post.published && <span style={{ color: 'var(--color-danger)' }}>【草稿】</span>}
                    {post.title}
                  </div>
                </Link>
                <div className="hidden md:block text-foreground-soft text-md mt-3">
                  <div className="line-clamp-3">{post.summary ?? ''}</div>
                </div>
              </div>
              <div>
                <div className="flex flex-1 items-center text-foreground-muted text-sm">
                  <div className="flex-1 hidden md:block">{formatShowDate(post.date)}</div>
                  <ListMetric icon={EyeIcon} value={post.meta.views} />
                  <ListMetric icon={HeartIcon} value={post.meta.likes} />
                  <ListMetric icon={CommentIcon} value={post.meta.comments} />
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

function ListMetric({ icon: Icon, value }: { icon: IconComponent; value: number }) {
  return (
    <div className="inline-flex items-center ml-2.5 bg-transparent text-foreground">
      <Icon className="text-md" />
      <span className="pl-[0.35rem]">{value}</span>
    </div>
  )
}

export interface PostSquareProps {
  post: ListingPostCardWithMetadata
  first: boolean
}

export function PostSquare({ post, first }: PostSquareProps) {
  return (
    <div className={first ? 'col-span-2 md:col-span-2 xl:col-span-2' : undefined}>
      <div className="relative flex flex-col min-w-0 break-words mb-0 flex-auto">
        <Media ratio={first ? '36x17' : '1x1'} className="flex-auto">
          <MediaCover as={Link} to={post.permalink} hover prefetch="intent">
            <Image
              src={post.cover}
              alt={post.title}
              width={first ? 600 : 300}
              height={300}
              thumbhash={post.coverThumbhash}
            />
            <div className={`${HOVER_OVERLAY_CLASS} group-hover:opacity-[0.22]`} />
          </MediaCover>
        </Media>
        <div className="absolute right-0 bottom-0 left-0 z-(--z-card-overlay-1) p-2 md:px-4 md:py-3">
          <Link to={post.permalink} className="flex flex-col flex-none" prefetch="intent">
            <div className="line-clamp-2 block mb-2 text-base font-semibold text-white hover:text-foreground-on-dark">
              {post.title}
            </div>
            <div className="flex flex-1 text-sm text-foreground-on-dark-muted">
              <span className="inline-block">{formatShowDate(post.date)}</span>
              <div className="flex-1" />
              <SquareMetric icon={EyeIcon} value={post.meta.views} />
              <SquareMetric icon={HeartIcon} value={post.meta.likes} />
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

function SquareMetric({ icon: Icon, value }: { icon: IconComponent; value: number }) {
  return (
    <div className="inline-flex items-center ml-2.5 bg-transparent">
      <Icon className="text-md" />
      <span className="pl-[0.35rem]">{value}</span>
    </div>
  )
}
