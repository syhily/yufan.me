import { defineMiddleware } from 'astro:middleware'
import querystring from 'node:querystring'

import { userSession } from '@/helpers/auth/session'
import { getLogger } from '@/helpers/logger'
import { ADMIN_ENDPOINTS, isAdminEndpoint, isAdminPath } from '@/web/middleware/admin-endpoints'

const log = getLogger('middleware.auth')

// Gates everything under `/wp-admin/*` behind a logged-in session, redirecting
// anonymous visitors to the login page with a `redirect_to` query parameter
// so they end up where they wanted after signing in.
export const authentication = defineMiddleware(async ({ url, redirect, session }, next) => {
  if (session === undefined) {
    log.warn('Astro session is required to be enabled')
    return next()
  }

  const { pathname } = url
  if (isAdminEndpoint(pathname)) {
    return next()
  }
  if (isAdminPath(pathname)) {
    const user = await userSession(session)
    if (user === undefined) {
      return redirect(
        `${ADMIN_ENDPOINTS.login}?${querystring.stringify({ redirect_to: `${import.meta.env.SITE}/wp-admin/` })}`,
      )
    }
  }
  return next()
})
