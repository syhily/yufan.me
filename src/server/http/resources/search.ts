import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

// `/search` has no UI — plain visits go home; `?q=...` GET forms canonicalise
// to the stable public `/search/:keyword` route.
export const searchRouter = new Hono<Env>().get('/search', (c) => {
  const query = c.req.query('q')?.trim() ?? ''
  return c.redirect(query ? `/search/${encodeURIComponent(query)}` : '/', 301)
})
