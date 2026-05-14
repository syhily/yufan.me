import { Hono } from 'hono'

import { apiContract } from '@/shared/contracts'

import type { Env } from './context'

import { accountController } from './controllers/account.controller'
import { authController } from './controllers/auth.controller'
import { adminRoute, authedRoute } from './guards'

export function createApiApp(): Hono<Env> {
  const app = new Hono<Env>()

  // Account routes (any authenticated user)
  authedRoute(app, apiContract.account, accountController as any)

  // Auth routes (admin only)
  adminRoute(app, apiContract.auth, authController as any)

  return app
}
