import { redirect } from 'react-router'

import type { Route } from './+types/search.index'

function searchRootPath(query: string): string {
  return `/search/${encodeURIComponent(query)}`
}

function redirectFromSearchIndex(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  return redirect(query ? searchRootPath(query) : '/', { status: 301 })
}

// Permanent (301) redirect — `/search` has no UI of its own. Plain visits go
// home; progressive-enhancement GET forms canonicalise `?q=...` to the stable
// public `/search/:keyword` route.
export const loader = ({ request }: Route.LoaderArgs) => redirectFromSearchIndex(request)

// Avoid an extra round-trip when a client-side navigation tries to land on
// `/search`: short-circuit to the canonical target directly.
export const clientLoader = ({ request }: Route.ClientLoaderArgs) => redirectFromSearchIndex(request)

export function headers() {
  return { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable' }
}
