import { createMiddleware } from 'hono/factory'

import type { Env } from '@/server/http/context'

import { getClientAddress } from '@/shared/request'

export const clientAddressMiddleware = createMiddleware<Env>(async (c, next) => {
  c.set('clientAddress', getClientAddress(c.req.raw))
  await next()
})
