import { notFound } from '@/server/route-helpers/http'
import { assertNotWordPressDecoy } from '@/server/route-helpers/wp-decoy'

import type { Route } from './+types/not-found'

// Lowest-priority splat (`*`) — React Router only matches it when nothing
// else does, so it never shadows static or `:slug` routes. Multi-segment
// WordPress probes (`/wp-content/**`, `/cgi-bin/**`, …) land here, so we
// run the WP-decoy check up top — a hit throws the canonical
// `Not WordPress` 404 from inside this loader so the public layout's
// `ErrorBoundary` (with its synchronous `<PublicChrome>` shell)
// catches it. Anything that survives the check is a real 404 and falls
// through to `notFound()`. The `default` component MUST exist even
// though the loader always throws: without it React Router treats the
// module as a resource route and streams the raw thrown `Response`
// to the client (text/plain, no chrome). The presence of `default`
// makes it a UI route so the surrounding `ErrorBoundary` can render
// the right view.
export function loader({ request }: Route.LoaderArgs) {
  assertNotWordPressDecoy(request)
  notFound()
}

export default function NotFoundRoute() {
  return null
}
