import type { MiddlewareFunction } from 'react-router'

import { requestContext, sessionContext } from '@/server/auth/context'
import { resolveSessionContext } from '@/server/auth/primitives'
import { getClientAddress } from '@/shared/request'

export const sessionMiddleware: MiddlewareFunction<Response> = async ({ request, context }, next) => {
  const session = await resolveSessionContext(request)
  context.set(sessionContext, session)
  context.set(requestContext, {
    clientAddress: getClientAddress(request),
    url: new URL(request.url),
  })
  return next()
}
