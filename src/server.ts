import { requestId } from 'hono/request-id'
import { RouterContextProvider } from 'react-router'
import { createHonoServer } from 'react-router-hono-server/node'

import { requestContext, sessionContext } from '@/server/auth/context'
import { honoInstallGateMiddleware } from '@/server/http/install-gate'
import { buildRouteContexts, honoSessionMiddleware } from '@/server/http/session'
import { honoVisitorCookieMiddleware } from '@/server/http/visitor-cookie'

export default await createHonoServer({
  configure(app) {
    app.use(requestId())
    app.use(honoSessionMiddleware)
    app.use(honoInstallGateMiddleware)
    app.use(honoVisitorCookieMiddleware)
  },
  getLoadContext(c) {
    const { session, request } = buildRouteContexts(c as any)
    const context = new RouterContextProvider()
    context.set(sessionContext, session)
    context.set(requestContext, request)
    return context
  },
})
