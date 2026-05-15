import { createMiddleware } from 'hono/factory'

import type { Env } from '@/server/http/context'

import { isWordPressDecoyPath } from '@/server/route-helpers/wp-decoy'

export const wpDecoyMiddleware = createMiddleware<Env>(async (c, next) => {
  if (isWordPressDecoyPath(new URL(c.req.url).pathname)) {
    return c.text('Not WordPress', 404)
  }
  await next()
})
