// `createApiApp()` — the entire JSON API surface, expressed as one
// Hono sub-app. Mounted at the root by `src/entry/server.node.ts`.
//
// Reading the calls inside this function gives you the project's
// complete permission matrix: each `authedRoute` / `adminRoute` /
// `publicRoute` line is one sub-tree of `apiContract` and its
// minimum required role.
//
// Phase A1 spike: only `accountContract` is wired. Subsequent
// phases (B1..B14) extend this function as each domain is ported.

import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

import { accountController } from '@/server/http/controllers/account.controller'
import { onErrorHandler } from '@/server/http/errors'
import { authedRoute } from '@/server/http/guards'
import { apiContract } from '@/shared/contracts'

export function createApiApp(): Hono<Env> {
  const app = new Hono<Env>()

  app.onError(onErrorHandler)

  // Authenticated account endpoints — any logged-in role can hit
  // `/api/account/profile`. Visitor / author / admin distinctions
  // are enforced inside the controller (badge fields are
  // visitor-locked).
  authedRoute(app, apiContract.account, accountController)

  return app
}
