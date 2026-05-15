import { createMiddleware } from 'hono/factory'

import type { Env } from '@/server/http/context'

import { resolveSessionContext } from '@/server/auth/primitives'

export const sessionMiddleware = createMiddleware<Env>(async (c, next) => {
  const { session, user, role } = await resolveSessionContext(c.req.raw)

  c.set('session', session)
  if (user && role) {
    c.set('viewer', { userId: user.id, role })
  }

  await next()
})
