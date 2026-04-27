// Lightweight placeholder shown while the comments promise streams in via
// React Router's `<Await>` boundary. Mirrors the outer chrome of `Comments`
// so the layout doesn't shift when the real island hydrates.
//
// The shimmer surface uses the `comments-skeleton-line` class declared in
// `globals.css` `@layer utilities` for the static gradient + background
// sizing (those interpolate awkwardly through plain Tailwind utilities),
// and adds `animate-shimmer` for the moving keyframe defined in `@theme`.
export function CommentsSkeleton() {
  return (
    <div id="comments" className="pt-5" aria-busy="true" aria-live="polite">
      <div className="text-[1.25rem] font-semibold leading-[1.4] mb-4">
        评论 <small className="text-sm text-foreground-muted">(加载中…)</small>
      </div>
      <div className="flex flex-col gap-3">
        <div className="comments-skeleton-line animate-shimmer h-4 rounded" />
        <div className="comments-skeleton-line animate-shimmer h-4 rounded w-3/5" />
        <div className="comments-skeleton-line animate-shimmer h-4 rounded" />
      </div>
    </div>
  )
}
