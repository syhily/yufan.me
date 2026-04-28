import { EllipsisIcon } from '@/ui/icons/icons'

export interface AdminCommentsPaginationProps {
  totalPages: number
  /** 0-based current page index. */
  currentPage: number
  onChange: (page: number) => void
}

// Mirrors the look of `Pagination.tsx` (used by post listings) but operates
// over local state instead of URLs since the admin comments page never
// changes its route — pagination only refetches the data via
// `useFetcher`.
export function AdminCommentsPagination({ totalPages, currentPage, onChange }: AdminCommentsPaginationProps) {
  if (totalPages <= 1) return null

  const currentPageNum = currentPage + 1
  let pages: number[]
  let leadingDots = false
  let trailingDots = false
  let leadingFirst = false
  let trailingLast = false

  if (totalPages <= 6) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  } else if (currentPageNum < 5) {
    pages = [1, 2, 3, 4, 5]
    trailingDots = true
    trailingLast = true
  } else if (currentPageNum > totalPages - 4) {
    pages = [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    leadingFirst = true
    leadingDots = true
  } else {
    pages = [currentPageNum - 1, currentPageNum, currentPageNum + 1]
    leadingFirst = true
    leadingDots = true
    trailingDots = true
    trailingLast = true
  }

  return (
    <nav className="navigation pagination" aria-label="评论">
      <h2 className="screen-reader-text">评论导航</h2>
      <div className="nav-links">
        {leadingFirst && <PageLink page={1} active={false} onChange={onChange} />}
        {leadingDots && <Dots />}
        {pages.map((p) => (
          <PageLink key={p} page={p} active={p === currentPageNum} onChange={onChange} />
        ))}
        {trailingDots && <Dots />}
        {trailingLast && <PageLink page={totalPages} active={false} onChange={onChange} />}
      </div>
    </nav>
  )
}

interface PageLinkProps {
  page: number
  active: boolean
  onChange: (page: number) => void
}

function PageLink({ page, active, onChange }: PageLinkProps) {
  if (active) {
    return (
      <span aria-current="page" className="page-numbers current">
        {page}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="page-numbers"
      data-page={page}
      onClick={() => {
        onChange(page - 1)
      }}
    >
      {page}
    </button>
  )
}

function Dots() {
  return (
    <span className="page-numbers dots" aria-hidden="true">
      <EllipsisIcon />
    </span>
  )
}
