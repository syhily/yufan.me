import { MoreHorizontalIcon } from 'lucide-react'
import { Link } from 'react-router'

import { computePageWindow } from '@/shared/pagination'
import { chipActive, chipBase, chipResting } from '@/ui/components/ui/pagination'
import { cn } from '@/ui/lib/cn'

export interface PaginationProps {
  current: number
  total: number
  rootPath: string
}

// Public-site Pagination ---------------------------------------------------
//
// Visual contract is shared with the admin shell pagination
// (`src/ui/components/ui/pagination.tsx`). Both surfaces compose the
// same `chipBase + chipResting/chipActive` Tailwind chains so a chip
// reads identically in `/page/2` and in `/wp-admin/posts`, and share
// the same windowing algorithm (`computePageWindow` in
// `@/shared/pagination`) so the rendered chip sequence is identical
// for any (current, total) tuple. The only differences are:
//
//   * Element shape — public chips are `<Link>` (real navigation) and
//     `<span>` (ellipsis / current page); admin chips are `<button>`
//     (callback-driven). The chip class treats both as equivalent.
//   * Neither view renders prev/next.
export function Pagination({ current, total, rootPath }: PaginationProps) {
  const items = computePageWindow({ current, total })
  if (items.length === 0) {
    return null
  }
  return (
    <nav aria-label="文章" data-slot="pagination" className="navigation mx-auto flex w-full justify-center">
      {/* Sr-only landmark heading: kept for assistive tech parity with
          the legacy markup. `screen-reader-text` is a long-standing
          public-site utility from `reset.css`. */}
      <h2 className="screen-reader-text">文章导航</h2>
      <ul data-slot="pagination-content" className="flex flex-row flex-wrap items-center justify-center gap-2">
        {items.map((item, i) =>
          item === 'ellipsis' ? (
            // Index suffix because the same array can carry two ellipses
            // (left + right) in the windowed layout; the page-number key
            // is unique only inside the number subset.
            <Ellipsis key={`ellipsis-${i}`} />
          ) : (
            <PageItem key={item} pageNum={item} current={current} rootPath={rootPath} />
          ),
        )}
      </ul>
    </nav>
  )
}

function Ellipsis() {
  return (
    <li data-slot="pagination-item">
      <span
        aria-hidden
        data-slot="pagination-ellipsis"
        // Ellipsis stays on the resting palette but suppresses the
        // hover swap — there's nothing to navigate to. `cursor-default`
        // overrides the link/button cursor users expect on a chip.
        className={cn(chipBase, chipResting, 'cursor-default hover:bg-foreground hover:text-primary-foreground')}
      >
        <MoreHorizontalIcon className="size-4" aria-hidden />
        <span className="sr-only">更多</span>
      </span>
    </li>
  )
}

interface PageItemProps {
  current: number
  pageNum: number
  rootPath: string
}

function PageItem({ current, pageNum, rootPath }: PageItemProps) {
  const isCurrent = current === pageNum
  if (isCurrent) {
    return (
      <li data-slot="pagination-item">
        <span aria-current="page" data-slot="pagination-link" data-active className={cn(chipBase, chipActive)}>
          {pageNum}
        </span>
      </li>
    )
  }
  const base = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath
  const to = pageNum === 1 ? rootPath : `${base}/page/${pageNum}`
  // Adjacent pages (±1) are very likely the user's next destination, so we
  // ask React Router to prefetch them on render. Other windowed entries use
  // intent-based prefetching to keep the network quiet.
  const prefetch = Math.abs(pageNum - current) === 1 ? 'render' : 'intent'
  return (
    <li data-slot="pagination-item">
      <Link data-slot="pagination-link" className={cn(chipBase, chipResting)} to={to} prefetch={prefetch}>
        {pageNum}
      </Link>
    </li>
  )
}
