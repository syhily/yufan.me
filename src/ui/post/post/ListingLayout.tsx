import { Link } from 'react-router'

import type { ListingPostCardWithMetadata } from '@/server/catalog'
import type { IconComponent } from '@/ui/icons/icons'

import { formatShowDate } from '@/shared/formatter'
import { EyeIcon, HeartIcon } from '@/ui/icons/icons'
import { Pagination } from '@/ui/post/pagination/Pagination'
import { Container } from '@/ui/primitives/Container'
import { Heading } from '@/ui/primitives/Heading'
import { Image } from '@/ui/primitives/Image'
import { Media } from '@/ui/primitives/Media'
import { MediaCover } from '@/ui/primitives/MediaCover'

const LISTING_SHELL_CLASS = 'py-4 md:py-6 lg:px-2 2xl:p-12'

const HOVER_OVERLAY_CLASS =
  'w-full h-full bg-[rgb(40_49_73/0.66)] absolute opacity-60 top-0 left-0 transition-opacity duration-300 ease-in-out'

export interface PostListingBodyProps {
  title: string
  description?: string
  resolvedPosts: ListingPostCardWithMetadata[]
  pageNum: number
  totalPage: number
  rootPath: string
  alwaysRenderPagination?: boolean
}

// Shared listing shell used by `/cats/:slug`, `/tags/:slug`, `/search/:keyword`,
// and `/archives`. The grid lays cards out in 2/3/4 columns and the first
// card spans both columns to anchor the page.
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

export interface PostSquareProps {
  post: ListingPostCardWithMetadata
  first: boolean
}

// Compact square card used by listing pages and `/archives`. The first
// card on the page spans 2 columns and uses the wider 36x17 aspect ratio
// so it reads as the lead.
export function PostSquare({ post, first }: PostSquareProps) {
  // Per the P1-5 prefetch budget table, the first listing card is the
  // lead and a likely-LCP candidate, so we keep `intent` (warm on hover
  // / focus). Subsequent cards switch to `viewport` so the user only
  // pays for prefetches once a card scrolls into view — listings render
  // 12 cards on `xl+` and the data-saver / mobile cost of warming
  // every one is too high.
  //
  // Listing pages (`/cats/:slug`, `/tags/:slug`, `/search/:keyword`,
  // `/archives`) never render the home `FeaturePost` hero, so the
  // first square card *is* the LCP candidate on every page — `first`
  // doubles as the `priority` flag here. P1-6.
  const prefetch = first ? 'intent' : 'viewport'
  return (
    <div className={first ? 'col-span-2 md:col-span-2 xl:col-span-2' : undefined}>
      <div className="relative flex flex-col min-w-0 break-words mb-0 flex-auto">
        <Media ratio={first ? '36x17' : '1x1'} className="flex-auto">
          <MediaCover as={Link} to={post.permalink} hover prefetch={prefetch}>
            <Image
              src={post.cover}
              alt={post.title}
              width={first ? 600 : 300}
              height={300}
              thumbhash={post.coverThumbhash}
              priority={first}
            />
            <div className={`${HOVER_OVERLAY_CLASS} group-hover:opacity-[0.22]`} />
          </MediaCover>
        </Media>
        <div className="absolute right-0 bottom-0 left-0 z-(--z-card-overlay-1) p-2 md:px-4 md:py-3">
          <Link to={post.permalink} className="flex flex-col flex-none" prefetch={prefetch}>
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
