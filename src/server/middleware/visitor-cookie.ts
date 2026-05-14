import type { MiddlewareFunction } from 'react-router'

import { resolveVisitorCookie } from '@/server/analytics/visitor-cookie'

// Issue the long-lived `yf_aid` analytics visitor cookie on any
// response where the browser doesn't already carry one. Lives in a
// dedicated middleware (rather than baked into the root loader)
// because:
//
//   * The root loader returns plain JSON, not a `Response`, so adding
//     `Set-Cookie` there would force every other route loader to
//     reshape its return value to thread the header through.
//   * Resource routes (`/sitemap.xml`, `/feed.atom`, `/image.og.*`)
//     do not render through the root loader at all — they need the
//     cookie too if a future analytics surface ever wants to credit
//     them.
//   * Skipping noisy / asset paths is a one-place pathname check
//     here, not three.
//
// The cookie is harmless when set on responses we never plan to
// track (e.g. admin pages). Skipping a few internal RR paths keeps
// every Set-Cookie hit aligned with a real user-facing page render.

const EXEMPT_PATH_PREFIXES = ['/__manifest', '/assets/', '/build/', '/api/']

function isExempt(pathname: string): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export const visitorCookieMiddleware: MiddlewareFunction<Response> = async ({ request }, next) => {
  const url = new URL(request.url)
  if (isExempt(url.pathname)) {
    return next()
  }
  const { setCookie } = resolveVisitorCookie(request)
  const response = await next()
  if (setCookie) {
    // `Response.headers` is mutable; `append` keeps any Set-Cookie
    // headers the route loader already emitted (e.g. CSRF /
    // `__session` rotation) instead of overwriting them.
    response.headers.append('Set-Cookie', setCookie)
  }
  return response
}
