// Rendered by `src/root.tsx`'s ErrorBoundary when a request matches the
// WordPress probe pattern (see `src/routes/_shared/wp-decoy.ts`). Mirrors the
// data-null layout used by the regular 404 view so chrome stays consistent;
// only the copy changes.
export function NotWordPressView() {
  return (
    <div className="flex h-[50vh] flex-1 flex-col text-center">
      <div className="my-auto">
        <h1 className="text-[6rem]">404</h1>
        <div>这里不是 WordPress 网站，请停止扫描。</div>
        <div className="text-foreground-muted mt-2">This is not a WordPress site. Please stop probing.</div>
      </div>
    </div>
  )
}
