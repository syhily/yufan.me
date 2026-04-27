import { feedHeaders, feedResponse } from '@/server/feed'

import type { Route } from './+types/feed.rss'

// Single module mounted at three URLs by `routes.ts`: `/feed`,
// `/cats/:slug/feed`, `/tags/:slug/feed`. The route manifest re-uses this
// same file via distinct `id`s (`routes/feed.rss`, `category-feed-rss`,
// `tag-feed-rss`); the loader infers the scope from the URL path because
// React Router exposes the matched `:slug` param identically across all
// three patterns.
export const headers = () => feedHeaders('rss')

export function loader({ request, params }: Route.LoaderArgs) {
  return feedResponse('rss', scopeFromUrl(request.url, getSlug(params)))
}

// Helpers exported so `feed.atom.ts` can mirror the same dispatch without
// re-deriving the scope from the URL twice. Kept in this file (not in a
// `_shared/feed.ts`) so the module count stays at two and the React Router
// route file co-locates with the inference logic it owns.
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
