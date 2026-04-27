import type { ReactNode } from 'react'

import { Link } from 'react-router'

import type { SidebarSnapshotOutput } from '@/client/api/action-types'
import type { ListingPostCard, ListingPostCardWithMetadata } from '@/server/catalog'

import { Pagination } from '@/ui/post/pagination/Pagination'
import { PostRowCard, PostRowCardSkeleton } from '@/ui/post/post/PostRowCard'
import { Container } from '@/ui/primitives/Container'
import { Image } from '@/ui/primitives/Image'
import { Media } from '@/ui/primitives/Media'
import { MediaCover } from '@/ui/primitives/MediaCover'
import { Sidebar, type SidebarData } from '@/ui/sidebar/Sidebar'

// Shared chrome class used by both the live home composition and its
// Suspense skeleton.
const LISTING_SHELL_CLASS = 'py-4 md:py-6 lg:px-2 2xl:p-12'

// Hover scrim sat over the cover of feature posts. Matches the legacy
// look exactly — the value used to live as a top-level constant inside
// the giant `PostListViews.tsx` file before the P0-4 split.
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
          {/*
            `posts[0]` is the lead hero — the largest above-the-fold
            cover and a near-certain LCP candidate on page 1. Only that
            cover gets `priority` so the browser fires the request
            before idle and bumps `fetchPriority` against concurrent
            sidebar / feature image fetches. The two right-rail
            features (`posts[1]`, `posts[2]`) stay lazy/auto so the
            single high-priority download wins the LCP race.
          */}
          <div className="min-w-0">
            <FeaturePost post={posts[0]} priority />
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

function FeaturePost({ post, priority = false }: { post: ListingPostCard; priority?: boolean }) {
  return (
    <div className="relative flex flex-col min-w-0 break-words mb-0 flex-auto">
      <Media ratio="3x2" className="flex-auto">
        <MediaCover as={Link} to={post.permalink} hover prefetch="intent">
          <Image
            src={post.cover}
            alt={post.title}
            width={750}
            height={500}
            thumbhash={post.coverThumbhash}
            priority={priority}
          />
          <div className={`${HOVER_OVERLAY_CLASS} group-hover:opacity-[0.22]`} />
        </MediaCover>
      </Media>
      <div className="absolute right-0 bottom-0 left-0 z-(--z-card-overlay-1) p-2 md:p-3">
        <div className="flex flex-col flex-none">
          <Link
            to={post.permalink}
            className="line-clamp-2 m-0 block mb-2 text-card-title font-semibold text-white hover:text-foreground-on-dark"
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
  // On page 1 the LCP candidate is the lead `<FeaturePost posts[0]>`
  // hero (`priority`-marked above), so the first row card stays lazy /
  // auto. On page 2+ we don't render `FeaturePosts`, so the first row
  // card becomes the LCP candidate and gets `priority` so the browser
  // upgrades its cover fetch to `loading="eager"` +
  // `fetchPriority="high"`. Per Vercel's `rendering-resource-hints`
  // we never mark more than one image as the LCP candidate.
  const firstCardOwnsLcp = pageNum > 1
  return (
    <div className="w-full xl:w-3/4 xl:px-3">
      <div>
        {/*
          The first row card on page 1 is the highest-confidence post-grid
          click target — it's above the fold, the user already paid the
          hero/feature cost, and the subsequent cards stream in via
          viewport prefetch. Everything below switches to `viewport`
          per the P1-5 budget so a desktop hero load doesn't queue a
          fetch for every card on the page.
        */}
        {posts.map((post, index) => (
          <PostRowCard
            key={post.slug}
            post={post}
            categoryHref={categoryLinks[post.category] || '/'}
            first={index === 0}
            priority={firstCardOwnsLcp && index === 0}
          />
        ))}
      </div>
      <Pagination current={pageNum} total={totalPage} rootPath="/" />
    </div>
  )
}

interface HomeListingSkeletonProps {
  cached: SidebarSnapshotOutput
}

// Suspense fallback for the home `clientLoader` SWR path. The cached
// sidebar slice (admin / recent / pending comments) renders immediately
// from `cached`; everything else (feature posts, post grid, sidebar
// random posts / tags / calendar) shows a placeholder shimmer until the
// server response resolves through `<Suspense>`.
//
// `posts: []` and `tags: []` make `<RandomPosts>` / `<RandomTags>` /
// `<TodayCalendar>` short-circuit out of the sidebar, so the skeleton
// never paints stale placeholders alongside the live cached widgets.
// Once `fresh` resolves, `HomeBody` swaps in with the canonical layout.
export function HomeListingSkeleton({ cached }: HomeListingSkeletonProps) {
  const sidebarData: SidebarData = {
    posts: [],
    tags: [],
    recentComments: cached.recentComments,
    pendingComments: cached.pendingComments,
  }
  return (
    <div className={LISTING_SHELL_CLASS}>
      <Container>
        <div className="flex flex-col xl:-mx-3 xl:flex-row">
          <div className="w-full xl:w-3/4 xl:px-3" aria-busy="true" aria-live="polite">
            <PostCardsSkeleton />
          </div>
          <Sidebar data={sidebarData} admin={cached.admin} />
        </div>
      </Container>
    </div>
  )
}

const SKELETON_CARD_COUNT = 5

function PostCardsSkeleton() {
  return (
    <div>
      {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
        <PostRowCardSkeleton key={i} />
      ))}
    </div>
  )
}
