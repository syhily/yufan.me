// Rendered by `src/root.tsx`'s ErrorBoundary when a request matches the
// WordPress probe pattern (see `src/routes/_shared/wp-decoy.ts`). Reuses the
// regular 404 view's vertical-centred 50vh shell so layout stays consistent;
// only the copy changes.
export function NotWordPressView() {
  return (
    <div className="flex h-(--size-empty-state) flex-auto flex-col text-center">
      <div className="my-auto">
        <h1 className="font-number text-empty-state-hero">404</h1>
        <div>这里不是 WordPress 网站，请停止扫描。</div>
        <div className="mt-2 text-ink-muted">This is not a WordPress site. Please stop probing.</div>
      </div>
    </div>
  )
}
