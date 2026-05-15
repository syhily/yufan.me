import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

// `/tags` has no UI of its own — permanent redirect to home.
// Paired with long-lived Cache-Control so CDN / browsers serve without origin hit.
export const tagsRouter = new Hono<Env>().get('/tags', (c) => {
  c.header('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable')
  return c.redirect('/', 301)
})
