import { Link, isRouteErrorResponse } from 'react-router'

import { cn } from '@/ui/lib/cn'

// Per-section error UI surfaced by route-level `ErrorBoundary` exports.
// Sections export a tiny wrapper that picks the right title / description /
// retry path and forwards the rest of the React Router error context to
// this component, so a thrown loader response (or a render-time exception)
// renders as an in-section card instead of bouncing to the global 404/500.
//
// Why a card and not a full-screen view: the root `ErrorBoundary` in
// `root.tsx` already owns the "whole page failed" experience. Section
// boundaries should keep the rest of the page chrome (header, footer,
// sidebar) interactive so the user can navigate without a hard reload.
export interface SectionErrorViewProps {
  error: unknown
  /** Headline, e.g. "无法加载文章" or "无法加载评论". */
  title: string
  /** Optional plain text shown below the headline. */
  description?: string
  /**
   * Optional in-app retry link. Defaults to the home page so the user is
   * never trapped in the broken section. Pass `null` to suppress the link.
   */
  retryHref?: string | null
  /** Label for the retry link. Defaults to "返回首页". */
  retryLabel?: string
  className?: string
}

export function SectionErrorView({
  error,
  title,
  description,
  retryHref = '/',
  retryLabel = '返回首页',
  className,
}: SectionErrorViewProps) {
  const detail = describeError(error)
  const showDetail = description ?? detail

  return (
    <section
      className={cn(
        'mx-auto my-12 flex w-full max-w-xl flex-col items-center rounded-lg border border-primary-100 bg-white px-6 py-10 text-center',
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      {showDetail && <p className="mt-3 text-sm text-foreground-muted">{showDetail}</p>}
      {retryHref && (
        <Link
          to={retryHref}
          prefetch="intent"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
        >
          {retryLabel}
        </Link>
      )}
    </section>
  )
}

// Best-effort textual rendering of whatever React Router handed us. Route
// boundaries can receive a thrown `Response` (we use `data()` / `notFound()`
// throws), a real `Error`, or anything else (`unknown`).
function describeError(error: unknown): string | undefined {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return '没有找到对应的内容。'
    }
    if (error.statusText) {
      return error.statusText
    }
    return `请求失败：HTTP ${error.status}`
  }
  if (error instanceof Error && import.meta.env.DEV) {
    return error.message
  }
  return undefined
}
