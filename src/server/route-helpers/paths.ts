// Canonical URL helpers shared by loaders, components, and tests. Pure
// string builders — no Response / redirect side effects so they're safe to
// import from both server and client modules.

export function searchRootPath(query: string): string {
  return `/search/${encodeURIComponent(query)}`
}

// When a post is fetched via one of its aliases, return the canonical
// `/posts/<slug>` so the route can issue a 301 redirect. Returns `undefined`
// when the requested slug is already the canonical one (no redirect needed).
export function canonicalPostPath(requestedSlug: string | undefined, canonicalSlug: string): string | undefined {
  return requestedSlug !== undefined && requestedSlug !== canonicalSlug ? `/posts/${canonicalSlug}` : undefined
}

// Build the canonical URL for page `pageNum` under `rootPath`. Page 1 of a
// listing is the bare root URL (no `/page/1` suffix) for canonical collapse.
export function pagePath(rootPath: string, pageNum: number): string {
  if (pageNum <= 1) return rootPath
  const pageRoot = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
  return `${pageRoot}page/${pageNum}`
}
