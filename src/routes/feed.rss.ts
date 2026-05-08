import { feedHeaders, feedResponse } from '@/server/feed'
import { getSlug, scopeFromUrl } from '@/server/feed/scope'

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
