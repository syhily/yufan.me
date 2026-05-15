import { createMiddleware } from 'hono/factory'

import type { Env } from '@/server/http/context'

import { resolveSessionContext } from '@/server/auth/primitives'
import { commitSession } from '@/server/auth/session-storage'

export const sessionMiddleware = createMiddleware<Env>(async (c, next) => {
  const { session, user, role } = await resolveSessionContext(c.req.raw)

  c.set('session', session)
  c.set('sessionDirty', false)
  if (user && role) {
    c.set('viewer', { userId: user.id, role })
  }

  await next()

  if (c.var.sessionDirty) {
    const setCookie = await commitSession(session)
    c.header('Set-Cookie', setCookie, { append: true })
  }
})
