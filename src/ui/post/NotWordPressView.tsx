// Rendered by `src/root.tsx`'s ErrorBoundary when a request matches the
// WordPress probe pattern (see `src/routes/_shared/wp-decoy.ts`). Reuses the
// `.data-null` block from the regular 404 view so layout stays consistent;
// only the copy changes.
export function NotWordPressView() {
  return (
    <div className="data-null">
      <div className="my-auto">
        <h1 className="font-number">404</h1>
        <div>这里不是 WordPress 网站，请停止扫描。</div>
        <div className="text-muted mt-2">This is not a WordPress site. Please stop probing.</div>
      </div>
    </div>
  )
}
