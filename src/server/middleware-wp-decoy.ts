import type { MiddlewareFunction } from 'react-router'

import { isWordPressDecoyPath, notWordPressSite } from '@/server/route-helpers/wp-decoy'

// Single chokepoint that intercepts WordPress scanner probes before any
// route loader (single-segment `:slug` like `/xmlrpc.php`, multi-segment
// splat like `/wp-content/plugins/x.php`) touches the catalog or session
// store. Used to live as duplicated checks at the top of `page.detail`
// and `not-found`; consolidating it here means there's exactly one place
// to update if the probe pattern list grows and one place to look at when
// debugging an unexpected 404 response.
export const wpDecoyMiddleware: MiddlewareFunction<Response> = ({ request }, next) => {
  if (isWordPressDecoyPath(new URL(request.url).pathname)) notWordPressSite()
  return next()
}
