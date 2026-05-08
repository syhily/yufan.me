// Lightweight placeholder shown while the comments promise streams in via
// React Router's `<Await>` boundary. Mirrors the outer chrome of `Comments`
// so the layout doesn't shift when the real island hydrates.
export function CommentsSkeleton() {
  return (
    <div id="comments" className="comments pt-12" aria-busy="true" aria-live="polite">
      <div className="comment-total-count mb-6 text-xl leading-[1.4] font-semibold">
        评论 <small className="font-theme text-sm text-ink-muted">(加载中…)</small>
      </div>
      <div className="comments-skeleton">
        <div className="comments-skeleton-line" />
        <div className="comments-skeleton-line comments-skeleton-line--short" />
        <div className="comments-skeleton-line" />
      </div>
    </div>
  )
}
