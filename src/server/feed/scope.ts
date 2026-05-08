// Feed route scope helpers. Extracted from `routes/feed.rss.ts` so both
// RSS and Atom resource routes can share the same URL → scope logic
// without cross-importing route modules.

export function getSlug(params: Record<string, string | undefined>): string | undefined {
  return params.slug
}

export function scopeFromUrl(url: string, slug: string | undefined): { category?: string; tag?: string } | undefined {
  if (slug === undefined) {
    return undefined
  }
  const pathname = new URL(url).pathname
  if (pathname.startsWith('/cats/')) {
    return { category: slug }
  }
  if (pathname.startsWith('/tags/')) {
    return { tag: slug }
  }
  return undefined
}
