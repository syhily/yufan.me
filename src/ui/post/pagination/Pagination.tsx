import { cva } from 'class-variance-authority'
import { Link } from 'react-router'

import { EllipsisIcon } from '@/ui/icons/icons'

export interface PaginationProps {
  current: number
  total: number
  rootPath: string
}

// Threshold above which we switch from rendering every page number to the
// windowed layout (first/last + neighborhood around current, with ellipses).
const DENSE_THRESHOLD = 6

// Per `vercel-composition-patterns/architecture-avoid-boolean-props`: use a
// `variant` enum instead of a boolean matrix. Mirrors the legacy
// `.page-numbers / .current / .dots` cascade so we can drop those rules in
// the Phase 2 sweep without changing the visual output.
//
// Colour decisions route through semantic tokens (`bg-foreground` for the
// idle dot, `bg-accent` for current/hover) so dark mode swaps everything
// in one go via `globals.css` — no hardcoded brand-hex / `bg-accent`
// pairs to keep aligned. Token rationale: the legacy literal lives in
// `--color-surface-inverse` (≈ `--color-foreground`) so the visual is
// preserved in light mode and inverted automatically in dark mode.
const pageItem = cva(
  'relative inline-block w-10 h-10 leading-10 text-center m-1 p-0 rounded-full text-accent-fg bg-foreground border-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'hover:bg-accent',
        current: 'bg-accent',
        dots: 'cursor-default',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Pagination({ current, total, rootPath }: PaginationProps) {
  if (total <= 1) {
    return null
  }
  return (
    <nav className="relative mt-5 md:mt-10" aria-label="文章">
      <h2 className="sr-only">文章导航</h2>
      <div className="flex flex-wrap justify-center w-full">
        {total <= DENSE_THRESHOLD ? (
          <DensePagination current={current} total={total} rootPath={rootPath} />
        ) : (
          <WindowedPagination current={current} total={total} rootPath={rootPath} />
        )}
      </div>
    </nav>
  )
}

interface InnerProps {
  current: number
  total: number
  rootPath: string
}

// Small page counts: render every page number without ellipses.
function DensePagination({ current, total, rootPath }: InnerProps) {
  return (
    <>
      {Array.from({ length: total }, (_, i) => i + 1).map((page) => (
        <PageLink key={page} pageNum={page} current={current} rootPath={rootPath} />
      ))}
    </>
  )
}

// Larger page counts: anchor the first/last page and keep a small window
// around the current page, separated by ellipses.
function WindowedPagination({ current, total, rootPath }: InnerProps) {
  const nearStart = current < 5
  const nearEnd = current > total - 4

  const windowPages = nearStart
    ? [1, 2, 3, 4, 5]
    : nearEnd
      ? [total - 4, total - 3, total - 2, total - 1, total]
      : [current - 1, current, current + 1]

  return (
    <>
      {!nearStart && (
        <>
          <PageLink pageNum={1} current={current} rootPath={rootPath} />
          <Ellipsis />
        </>
      )}
      {windowPages.map((page) => (
        <PageLink key={page} pageNum={page} current={current} rootPath={rootPath} />
      ))}
      {!nearEnd && (
        <>
          <Ellipsis />
          <PageLink pageNum={total} current={current} rootPath={rootPath} />
        </>
      )}
    </>
  )
}

function Ellipsis() {
  return (
    <span className={pageItem({ variant: 'dots' })}>
      <EllipsisIcon />
    </span>
  )
}

interface PageLinkProps {
  current: number
  pageNum: number
  rootPath: string
}

function PageLink({ current, pageNum, rootPath }: PageLinkProps) {
  if (current === pageNum) {
    return (
      <span aria-current="page" className={pageItem({ variant: 'current' })}>
        {pageNum}
      </span>
    )
  }
  const base = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath
  const to = pageNum === 1 ? rootPath : `${base}/page/${pageNum}`
  // Prefetch budget split per `react-router-framework-mode/loader-defer` and
  // `vercel-react-best-practices/bundle-dynamic-imports`:
  //   - Adjacent pages (±1) are the most likely next destination → `intent`,
  //     so the prefetch fires on hover/focus/touchstart instead of on every
  //     render. (`render` would burn the data-saver budget on first paint.)
  //   - All other windowed entries → `viewport`, so the prefetch only runs
  //     when the link actually enters the viewport. On mobile this skips
  //     the offscreen page numbers entirely; on desktop it still warms the
  //     cache for what the user can see.
  const prefetch = Math.abs(pageNum - current) <= 1 ? 'intent' : 'viewport'
  return (
    <Link className={pageItem({ variant: 'default' })} to={to} prefetch={prefetch}>
      {pageNum}
    </Link>
  )
}
