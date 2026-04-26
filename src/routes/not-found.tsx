import { notFound } from '@/server/route-helpers/http'

// Lowest-priority splat (`*`) — React Router only matches it when nothing
// else does, so it never shadows static or `:slug` routes. WordPress probes
// (single-segment `.php` and multi-segment `/wp-content/**`, …) are
// intercepted by `wpDecoyMiddleware` on the root route before the splat
// loader runs. Anything that lands here is a real 404. The `default`
// component MUST exist even though the loader always throws: without it
// React Router treats the module as a resource route and streams the raw
// thrown `Response` to the client (text/plain, no chrome). The presence
// of `default` makes it a UI route so the root `ErrorBoundary` handles
// the thrown response and renders the right view inside `<BaseLayout>`.
export function loader() {
  notFound()
}

export default function NotFoundRoute() {
  return null
}
