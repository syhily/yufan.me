import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

// Index-style redirects for legacy navigation entry points. The
// `/tags` and `/search` URLs predate the resource-route refactor;
// they now collapse onto the canonical surface (homepage + the
// `/search/<keyword>` path-style search endpoint) with a 301 so
// any inbound link or bookmark keeps resolving.
//
// Lives in `server/http/resources/` next to feed/sitemap/images
// rather than as inline `app.get(...)` calls in `server.ts`, per
// Plan §6 — non-JSON resource endpoints belong with each other,
// not in the SSR wiring file.

export const redirectsRouter = new Hono<Env>()

redirectsRouter.get('/tags', (c) => {
  c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable')
  return c.redirect('/', 301)
})

redirectsRouter.get('/search', (c) => {
  const query = c.req.query('q')?.trim() ?? ''
  c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable')
  return c.redirect(query ? `/search/${encodeURIComponent(query)}` : '/', 301)
})
