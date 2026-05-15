import { createMiddleware } from 'hono/factory'

import { isWordPressDecoyPath, NOT_WORDPRESS_STATUS_TEXT } from '@/server/route-helpers/wp-decoy'

import type { Env } from './context'

/**
 * WordPress probe detector mounted as Hono middleware.
 *
 * Previously lived in RR loaders (`page.detail` + `not-found`) so the
 * error boundary would render inside `<PublicChrome>`. After the Hono
 * migration the 404 response is returned directly by the HTTP layer;
 * the root React Router boundary still catches it and switches to
 * `<NotWordPressView />` via `statusText === 'Not WordPress'`.
 */
export const honoWpDecoyMiddleware = createMiddleware<Env>(async (c, next) => {
  if (isWordPressDecoyPath(c.req.path)) {
    return c.text(NOT_WORDPRESS_STATUS_TEXT, {
      status: 404,
      statusText: NOT_WORDPRESS_STATUS_TEXT,
    })
  }
  await next()
})
