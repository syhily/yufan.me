// Page-window algorithm shared by the public site
// (`src/ui/post/pagination/Pagination.tsx`) and the admin shell
// (`src/ui/admin/shared/AdminPagination.tsx`). Both surfaces compose
// the same chip ladder so a `/page/3` link reads identically in
// `/wp-admin/posts` and on the public archive.
//
// Inputs / outputs are 1-based — that matches the public consumer's
// existing semantics, the URL surface (`/page/3`), and human
// intuition. The admin business code is 0-based internally; admin
// callers must `+1` before invoking and `-1` on click.
//
// The algorithm:
//   * total <= 1 → no pagination needed; returns `[]`.
//   * total <= DENSE_THRESHOLD (6) → emit every page, no ellipses.
//   * total > 6 → "windowed" layout:
//       - near the start (current < 5): [1, 2, 3, 4, 5, …, total]
//       - near the end   (current > total - 4): [1, …, total-4 .. total]
//       - in the middle: [1, …, current-1, current, current+1, …, total]
//
// `'ellipsis'` is the literal sentinel for the gap chip — callers
// render it however they like (public uses a `<span>` with a
// `MoreHorizontalIcon`; admin uses the shadcn `<PaginationEllipsis>`).

/** Threshold above which we switch from dense to windowed layout. */
export const DENSE_THRESHOLD = 6

/** A single chip in the rendered ladder: a 1-based page number, or the
 *  literal `'ellipsis'` sentinel for the gap separator. */
export type PageWindowItem = number | 'ellipsis'

export interface PageWindowOptions {
  /** 1-based current page. Must be in `[1, total]`. */
  current: number
  /** Total number of pages. `total < 2` returns an empty array. */
  total: number
}

/** Compute the rendered page-chip sequence for `current` of `total`.
 *
 *  Returns the chip list in render order (left → right). Always
 *  includes `current` as a number. Always includes 1 and `total` as
 *  the leftmost / rightmost number chip when the windowed layout
 *  fires. `'ellipsis'` separators only appear on the side that hides
 *  pages.
 */
export function computePageWindow({ current, total }: PageWindowOptions): PageWindowItem[] {
  if (total <= 1) {
    return []
  }
  if (total <= DENSE_THRESHOLD) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  // Windowed layout — three branches that match the public site's
  // legacy `WindowedPagination` exactly. The branches are mutually
  // exclusive when `total > DENSE_THRESHOLD` (i.e. `total >= 7`):
  // `current < 5` covers pages 1-4, `current > total - 4` covers the
  // last four pages, and the middle covers the rest.
  const nearStart = current < 5
  const nearEnd = current > total - 4

  if (nearStart) {
    return [1, 2, 3, 4, 5, 'ellipsis', total]
  }
  if (nearEnd) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}
