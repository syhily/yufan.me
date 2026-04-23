import { defineMiddleware } from 'astro:middleware'

import { hasAdmin } from '@/helpers/auth/user'
import { ADMIN_ENDPOINTS } from '@/web/middleware/admin-endpoints'

// If the database already has an admin user, redirect users away from the
// "fresh install" wizard so they can't re-create the admin account.
export const freshInstall = defineMiddleware(async (context, next) => {
  const {
    url: { pathname },
    redirect,
  } = context

  if (pathname === ADMIN_ENDPOINTS.install) {
    if (await hasAdmin()) {
      return redirect('/')
    }
  }

  return next()
})
