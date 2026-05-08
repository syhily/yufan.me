import { cn } from '@/ui/lib/cn'

// Lightweight placeholder shown while the comments promise streams in via
// React Router's `<Await>` boundary. Mirrors the outer chrome of `Comments`
// so the layout doesn't shift when the real island hydrates.
//
// Visual contract: three pulsing horizontal bars (full / 60% / full). The
// shimmer keyframes + `--animate-comments-shimmer` token live in
// `@/assets/styles/tailwind.css` so Tailwind tree-shakes them when this
// component is not on the page; `motion-reduce:animate-none` honours
// `prefers-reduced-motion: reduce`.
const SHIMMER_LINE_CLASS =
  'h-4 rounded-[4px] bg-[linear-gradient(90deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.08)_50%,rgba(0,0,0,0.04)_100%)] bg-[length:200%_100%] animate-comments-shimmer motion-reduce:animate-none'

export function CommentsSkeleton() {
  return (
    <div id="comments" className="pt-12" aria-busy="true" aria-live="polite">
      <div className="mb-6 text-xl leading-[1.4] font-semibold">
        评论 <small className="font-theme text-sm text-ink-muted">(加载中…)</small>
      </div>
      <div className="flex flex-col gap-3">
        <div className={SHIMMER_LINE_CLASS} />
        <div className={cn(SHIMMER_LINE_CLASS, 'w-[60%]')} />
        <div className={SHIMMER_LINE_CLASS} />
      </div>
    </div>
  )
}
