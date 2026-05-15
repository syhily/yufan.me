import type { AppRouter } from '@ts-rest/core'
import type { Hono, MiddlewareHandler } from 'hono'

import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { hasAtLeast, type Role } from '@/shared/roles'

import type { Env } from './context'

import { mountContract, type ContractImpl } from './ts-rest-adapter'

const requireAuth = createMiddleware<Env>(async (c, next) => {
  const user = c.var.session.get('user')
  if (!user) {
    throw new HTTPException(401, { message: '未登录' })
  }
  c.set('viewer', { userId: user.id, role: user.role })
  await next()
})

const requireRoleMw = (role: Role) =>
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

type MiddlewareList = MiddlewareHandler<Env>[]

/** Mount with no auth — open to everyone. Accepts optional extra middleware. */
export function publicRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  extra?: MiddlewareList,
) {
  mountContract(app, contract, impl, { middleware: [...(extra ?? [])] })
}

/** Mount requiring any logged-in user. Accepts optional extra middleware. */
export function authedRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  extra?: MiddlewareList,
) {
  mountContract(app, contract, impl, { middleware: [requireAuth, ...(extra ?? [])] })
}

/** Mount gated to `role` or higher. Accepts optional extra middleware. */
export function roleRoute<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  role: Role,
  extra?: MiddlewareList,
) {
  mountContract(app, contract, impl, { middleware: [requireRoleMw(role), ...(extra ?? [])] })
}

export const adminRoute = <R extends AppRouter>(app: Hono<Env>, contract: R, impl: ContractImpl<R>) =>
  roleRoute(app, contract, impl, 'admin')

export const authorRoute = <R extends AppRouter>(app: Hono<Env>, contract: R, impl: ContractImpl<R>) =>
  roleRoute(app, contract, impl, 'author')
