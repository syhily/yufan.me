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

export function Pagination({ current, total, rootPath }: PaginationProps) {
  if (total <= 1) return null
  return (
    <nav className="navigation pagination" aria-label="文章">
      <h2 className="screen-reader-text">文章导航</h2>
      <div className="nav-links">
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
    <span className="page-numbers dots">
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
      <span aria-current="page" className="page-numbers current">
        {pageNum}
      </span>
    )
  }
  const base = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath
  const to = pageNum === 1 ? rootPath : `${base}/page/${pageNum}`
  // Adjacent pages (±1) are very likely the user's next destination, so we
  // ask React Router to prefetch them on render. Other windowed entries use
  // intent-based prefetching to keep the network quiet.
  const prefetch = Math.abs(pageNum - current) === 1 ? 'render' : 'intent'
  return (
    <Link className="page-numbers" to={to} prefetch={prefetch}>
      {pageNum}
    </Link>
  )
}
