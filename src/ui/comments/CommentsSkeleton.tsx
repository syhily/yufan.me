import { Skeleton } from '@/ui/primitives/Skeleton'

// Lightweight placeholder shown while the comments promise streams in via
// React Router's `<Await>` boundary. Mirrors the outer chrome of `Comments`
// so the layout doesn't shift when the real island hydrates.
//
// The shimmer surface lives in the shared `<Skeleton>` primitive at
// `@/ui/primitives/Skeleton` (which composes the `.skeleton-shimmer`
// gradient declared in `globals.css` `@layer utilities` and adds
// `animate-shimmer` for the keyframe defined in `@theme`).
export function CommentsSkeleton() {
  return (
    <div id="comments" className="pt-5" aria-busy="true" aria-live="polite">
      <div className="text-card-title font-semibold mb-4">
        评论 <small className="text-sm text-foreground-muted">(加载中…)</small>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4" />
      </div>
    </div>
  )
}
