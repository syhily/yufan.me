import { defineMiddleware } from 'astro:middleware'

import { hasAdmin } from '@/db/query/user'
import { ADMIN_ENDPOINTS } from '@/web/middleware/admin-endpoints'

// `hasAdmin()` only ever flips false → true (an admin is created by the
// fresh-install wizard and never deleted). Hitting the database on every
// request just to read the same answer is wasteful, so cache the positive
// result for the lifetime of the process. We still re-check while the answer
// is `false` so the very first install still gets noticed without a restart.
let cachedHasAdmin: boolean = false

async function isFreshInstall(): Promise<boolean> {
  if (cachedHasAdmin) return false
  const present = await hasAdmin()
  if (present) {
    cachedHasAdmin = true
    return false
  }
  return true
}

// If the database already has an admin user, redirect users away from the
// "fresh install" wizard so they can't re-create the admin account.
export const freshInstall = defineMiddleware(async (context, next) => {
  const {
    url: { pathname },
    redirect,
  } = context

  if (pathname === ADMIN_ENDPOINTS.install) {
    if (!(await isFreshInstall())) {
      return redirect('/')
    }
  }

  return next()
})
