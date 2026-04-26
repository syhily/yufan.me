// Lightweight placeholder shown while the comments promise streams in via
// React Router's `<Await>` boundary. Mirrors the outer chrome of `Comments`
// so the layout doesn't shift when the real island hydrates.
export function CommentsSkeleton() {
  return (
    <div id="comments" className="comments pt-5" aria-busy="true" aria-live="polite">
      <div className="h5 mb-4 comment-total-count">
        评论 <small className="font-theme text-sm text-muted">(加载中…)</small>
      </div>
      <div className="comments-skeleton">
        <div className="comments-skeleton-line" />
        <div className="comments-skeleton-line comments-skeleton-line--short" />
        <div className="comments-skeleton-line" />
      </div>
    </div>
  )
}
