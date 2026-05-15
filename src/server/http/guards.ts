import type { AppRouter } from '@ts-rest/core'
import type { Hono } from 'hono'

import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { hasAtLeast, type Role } from '@/server/auth/rbac'

import type { Env } from './context'

import { csrfGuard } from './csrf'
import { mountContract, type ContractImpl, type AuthedContractImpl, type PublicContractImpl } from './ts-rest-adapter'

const requireAuth = createMiddleware<Env>(async (c, next) => {
  const user = c.var.session.get('user')
  if (!user) {
    throw new HTTPException(401, { message: '未登录' })
  }
  c.set('viewer', { userId: user.id, role: user.role })
  await next()
})

export const requireRoleMw = (role: Role) =>
  createMiddleware<Env>(async (c, next) => {
    const user = c.var.session.get('user')
    if (!user) {
      throw new HTTPException(401, { message: '未登录' })
    }
    if (!hasAtLeast(user.role, role)) {
      throw new HTTPException(403, { message: '权限不足' })
    }
    c.set('viewer', { userId: user.id, role: user.role })
    await next()
  })

// ─── Public route mount (无鉴权) ──────────────────────
// `csrfGuard` is applied to every public route too. The middleware
// short-circuits GET / HEAD, so read endpoints are unaffected; only
// POST / PATCH / DELETE require a valid CSRF token. This eliminates
// the previous "inline csrf in the controller" pattern in
// `comment-public.controller` and keeps the security perimeter on
// one layer (Plan §5.4, finalization Plan §F2.2).
export function publicRoute<R extends AppRouter>(app: Hono<Env>, contract: R, impl: PublicContractImpl<R>) {
  mountContract(app, contract, impl, { middleware: [csrfGuard] })
}

// ─── Authed route mount (任何登录用户) ────────────────
export function authedRoute<R extends AppRouter>(app: Hono<Env>, contract: R, impl: AuthedContractImpl<R>) {
  mountContract(app, contract, impl as ContractImpl<R>, { middleware: [requireAuth, csrfGuard] })
}

// ─── Role-gated route mount ──────────────────────────
export function roleRoute<R extends AppRouter>(app: Hono<Env>, contract: R, impl: AuthedContractImpl<R>, role: Role) {
  mountContract(app, contract, impl as ContractImpl<R>, { middleware: [requireRoleMw(role), csrfGuard] })
}

export const adminRoute = <R extends AppRouter>(app: Hono<Env>, contract: R, impl: AuthedContractImpl<R>) =>
  roleRoute(app, contract, impl, 'admin')

export const authorRoute = <R extends AppRouter>(app: Hono<Env>, contract: R, impl: AuthedContractImpl<R>) =>
  roleRoute(app, contract, impl, 'author')
