import { redirect } from 'react-router'

import type { Route } from './+types/tags.index'

// Permanent (301) redirect — `/tags` has no UI of its own. Pair the redirect
// with a long-lived `Cache-Control` so Cloudflare / browsers can serve it
// without re-asking the origin.
export const loader = (_: Route.LoaderArgs) => redirect('/', { status: 301 })

// Mirror on the client to avoid a server round-trip on SPA navigations.
export const clientLoader = () => redirect('/', { status: 301 })

export function headers() {
  return { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable' }
}
