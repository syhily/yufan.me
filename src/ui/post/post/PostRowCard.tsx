import { Link } from 'react-router'

import type { ListingPostCardWithMetadata } from '@/server/catalog'
import type { IconComponent } from '@/ui/icons/icons'

import { formatShowDate } from '@/shared/formatter'
import { CommentIcon, EyeIcon, HeartIcon } from '@/ui/icons/icons'
import { cn } from '@/ui/lib/cn'
import { badgeVariants } from '@/ui/primitives/Badge'
import { Card } from '@/ui/primitives/Card'
import { Image } from '@/ui/primitives/Image'
import { Media, MediaOverlay } from '@/ui/primitives/Media'
import { MediaCover } from '@/ui/primitives/MediaCover'
import { Skeleton } from '@/ui/primitives/Skeleton'

// Brand row card used by the home listing (`<HomeLayoutBody>`) and its
// matching Suspense fallback (`<HomeListingSkeleton>`). Lives next to
// `HomeLayoutBody.tsx` and `ListingLayout.tsx` so the cover/category/title
// recipe has exactly one source of truth.
export interface PostRowCardProps {
  post: ListingPostCardWithMetadata
  categoryHref?: string
  /**
   * Whether this card is the first row in the home grid. When `true`
   * the cover, category overlay, and title links keep their `intent`
   * prefetch budget; otherwise we drop to `viewport` so subsequent
   * cards only warm once they scroll in. See
   * `routes/home.tsx → PostCards` for the wiring and the P1-5 budget
   * table for the rationale.
   */
  first?: boolean
  /**
   * Mark the cover image as the LCP candidate (eager load + high
   * fetch priority). Only one card on a page should opt in; on home
   * page 1 the LCP role belongs to the lead `FeaturePost`, so this
   * stays `false` there. See P1-6 and `routes/home.tsx → PostCards`
   * for the gating logic.
   */
  priority?: boolean
}

export function PostRowCard({ post, categoryHref = '/', first = false, priority = false }: PostRowCardProps) {
  const prefetch = first ? 'intent' : 'viewport'
  return (
    <Card orientation="row">
      <Media ratio="3x2" className="w-[45%] md:w-5/12">
        <MediaCover as={Link} to={post.permalink} prefetch={prefetch}>
          <Image
            src={post.cover}
            alt={post.title}
            width={600}
            height={400}
            thumbhash={post.coverThumbhash}
            priority={priority}
          />
        </MediaCover>
        <MediaOverlay top>
          {/*
           * The cover-image category overlay has its own translucent
           * surface (`bg-white-overlay`) and intentionally bypasses the
           * project tone palette — we only borrow the `size: 'md'`
           * layout dimensions from `badgeVariants`. No `data-tone`
           * attribute is emitted so `toneStyles.css` doesn't paint a
           * border over the overlay.
           */}
          <Link
            className={cn('hidden md:inline-block', badgeVariants({ size: 'md' }), 'border-0 bg-white-overlay')}
            to={categoryHref}
            prefetch={prefetch}
          >
            {post.category}
          </Link>
        </MediaOverlay>
      </Media>
      <div className="flex flex-col flex-auto justify-center bg-white p-3 pb-2 md:px-5 md:py-5 md:pb-4 2xl:p-6">
        <div className="flex-auto">
          <Link
            to={post.permalink}
            className="block text-card-title font-semibold text-inherit hover:text-accent"
            prefetch={prefetch}
          >
            <div className="line-clamp-2">
              {!post.published && <span className="text-danger">【草稿】</span>}
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
            <RowMetric icon={EyeIcon} value={post.meta.views} />
            <RowMetric icon={HeartIcon} value={post.meta.likes} />
            <RowMetric icon={CommentIcon} value={post.meta.comments} />
          </div>
        </div>
      </div>
    </Card>
  )
}

function RowMetric({ icon: Icon, value }: { icon: IconComponent; value: number }) {
  return (
    <div className="inline-flex items-center ml-2.5 bg-transparent text-foreground">
      <Icon className="text-md" />
      <span className="pl-[0.35rem]">{value}</span>
    </div>
  )
}

// Skeleton variant of `PostRowCard`. The brand-card chrome stays put so
// the Suspense fallback paints with the same shadow/spacing as the
// resolved cards — only the cover image and text rows get swapped for
// shimmer surfaces.
export function PostRowCardSkeleton() {
  return (
    <Card orientation="row">
      <Media ratio="3x2" className="w-[45%] md:w-5/12">
        <Skeleton className="h-full w-full rounded-none" />
      </Media>
      <div className="flex flex-col flex-auto justify-center bg-white p-3 pb-2 md:px-5 md:py-5 md:pb-4 2xl:p-6 gap-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </Card>
  )
}
