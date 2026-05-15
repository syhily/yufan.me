import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

export const redirectRouter = new Hono<Env>()
  .get('/tags', (c) => c.redirect('/', 301))
  .get('/search', (c) => {
    const query = c.req.query('q')?.trim() ?? ''
    return c.redirect(query ? `/search/${encodeURIComponent(query)}` : '/', 301)
  })
