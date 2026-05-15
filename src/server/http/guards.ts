// RBAC mount factories — `publicRoute` / `authedRoute` / `adminRoute`
// declare which contracts require which minimum role. Each factory
// composes the appropriate Hono middleware in front of every leaf
// route in the sub-tree before delegating to `mountContract`.
//
// The whole project's permission matrix lives at the call sites of
// these factories inside `server/http/app.ts` — reading that one file
// shows every endpoint's auth requirement.

import type { AppRouter } from '@ts-rest/core'
import type { Hono, MiddlewareHandler } from 'hono'

import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import type { Env } from '@/server/http/context'

import { hasAtLeast, type Role, type ViewerContext } from '@/server/auth/rbac'
import { mountContract, type ContractImpl } from '@/server/http/ts-rest-adapter'

// ---------------------------------------------------------------------------
// Reusable role middleware
// ---------------------------------------------------------------------------

const requireAuth = createMiddleware<Env>(async (c, next) => {
  const user = c.var.session.get('user')
  if (!user) {
    throw new HTTPException(401, { message: '需要登录后再操作。' })
  }
  const viewer: ViewerContext = { userId: user.id, role: user.role }
  c.set('viewer', viewer)
  await next()
})

function requireRoleMiddleware(role: Role): MiddlewareHandler<Env> {
  return createMiddleware<Env>(async (c, next) => {
    const user = c.var.session.get('user')
    if (!user) {
      throw new HTTPException(401, { message: '需要登录后再操作。' })
    }
    if (!hasAtLeast(user.role, role)) {
      throw new HTTPException(403, { message: '权限不足，需要更高角色。' })
    }
    const viewer: ViewerContext = { userId: user.id, role: user.role }
    c.set('viewer', viewer)
    await next()
  })
}

// ---------------------------------------------------------------------------
// Mount factories
// ---------------------------------------------------------------------------

export interface RouteMountOptions {
  // Extra middleware to compose AFTER the role check but BEFORE the
  // ts-rest handler. Used for CSRF on mutation contracts and
  // per-route rate-limit guards.
  middleware?: MiddlewareHandler<Env>[]
}

export function publicRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  options: RouteMountOptions = {},
): void {
  mountContract(app, contract, impl, { middleware: options.middleware ?? [] })
}

export function authedRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  options: RouteMountOptions = {},
): void {
  mountContract(app, contract, impl, {
    middleware: [requireAuth, ...(options.middleware ?? [])],
  })
}

export function roleRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  role: Role,
  options: RouteMountOptions = {},
): void {
  mountContract(app, contract, impl, {
    middleware: [requireRoleMiddleware(role), ...(options.middleware ?? [])],
  })
}

export function adminRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  options: RouteMountOptions = {},
): void {
  roleRoute(app, contract, impl, 'admin', options)
}

export function authorRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  options: RouteMountOptions = {},
): void {
  roleRoute(app, contract, impl, 'author', options)
}
