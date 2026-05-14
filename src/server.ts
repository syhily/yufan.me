import { RouterContextProvider } from 'react-router'
import { createHonoServer } from 'react-router-hono-server/node'

import { requestContext, sessionContext } from '@/server/auth/context'
import { buildRouteContexts, honoSessionMiddleware } from '@/server/http/session'

export default await createHonoServer({
  configure(app) {
    app.use(honoSessionMiddleware)
  },
  getLoadContext(c) {
    const { session, request } = buildRouteContexts(c as any)
    const context = new RouterContextProvider()
    context.set(sessionContext, session)
    context.set(requestContext, request)
    return context
  },
})
