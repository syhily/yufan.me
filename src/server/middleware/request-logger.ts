import { createMiddleware } from 'hono/factory'

import type { Env } from '@/server/http/context'

import { getLogger } from '@/server/logger'

const log = getLogger('http.request')

// Lightweight request logging middleware. Logs method, path, status, and duration
// for every non-HEALTHCHECK request. Keeps the log volume manageable by skipping
// static assets and HMR requests.
export const requestLoggerMiddleware = createMiddleware<Env>(async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start

  // Skip noisy/static paths
  const pathname = new URL(c.req.url).pathname
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/build/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/__manifest') ||
    pathname.startsWith('/node_modules/')
  ) {
    return
  }

  // Determine status from response
  const status = c.res.status

  log.info('request', {
    method: c.req.method,
    path: pathname,
    status,
    duration,
    ip: c.var.clientAddress,
  })
})
