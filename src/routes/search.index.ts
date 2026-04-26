import { redirect } from 'react-router'

import type { Route } from './+types/search.index'

// Permanent (301) redirect — `/search` has no UI of its own; landing here is
// always a typo or a stale crawler hit. The accompanying long-lived
// `Cache-Control` keeps Cloudflare / browsers from re-asking the origin.
export const loader = (_: Route.LoaderArgs) => redirect('/', { status: 301 })

// Avoid an extra round-trip when a client-side navigation tries to land on
// `/search`: short-circuit to `/` directly without hitting the server.
export const clientLoader = () => redirect('/', { status: 301 })

export function headers() {
  return { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable' }
}
