import { getSlug, scopeFromUrl } from '@/routes/feed.rss'
import { feedHeaders, feedResponse } from '@/server/feed'

import type { Route } from './+types/feed.atom'

// Atom counterpart of `feed.rss.ts`. The two formats only differ in
// content-type and serialiser, so we share the same `scopeFromUrl` helper
// and let `routes.ts` mount this module at the three Atom URLs.
export const headers = () => feedHeaders('atom')

export function loader({ request, params }: Route.LoaderArgs) {
  return feedResponse('atom', scopeFromUrl(request.url, getSlug(params)))
}
