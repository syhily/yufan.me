import type { ActionAPIContext } from 'astro:actions'

import { ActionError } from 'astro:actions'

import type { DomainErrorCode } from '@/schemas/errors'

import { DomainError } from '@/schemas/errors'
import { validateToken } from '@/services/auth/csrf'
import { isAdmin, userSession } from '@/services/auth/session'
import { exceedLimit, incrLimit } from '@/shared/cache'
import { getLogger } from '@/shared/logger'
import { ErrorMessages } from '@/shared/messages'

const log = getLogger('action.middleware')

// -----------------------------------------------------------------------------
// Action handler middleware. The previous codebase repeated `if (session ===
// undefined)` / `validateToken` / `exceedLimit` blocks at the top of every
// action. These wrappers compose those concerns cleanly so each handler stays
// focused on its business logic.
//
// Usage:
//   handler: withSession(withRateLimit({ key: 'ip' })(async (input, ctx) => {
//     ...
//   }))
// -----------------------------------------------------------------------------

type Handler<I, O> = (input: I, ctx: ActionAPIContext) => Promise<O>

const DOMAIN_TO_ACTION: Record<DomainErrorCode, ConstructorParameters<typeof ActionError>[0]['code']> = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'TOO_MANY_REQUESTS',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
}

export function toActionError(err: unknown): ActionError {
  if (err instanceof ActionError) return err
  if (err instanceof DomainError) {
    return new ActionError({ code: DOMAIN_TO_ACTION[err.code], message: err.message })
  }
  log.error('unexpected action error', { err: err instanceof Error ? err.message : String(err) })
  return new ActionError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : '服务器内部错误',
  })
}

// Convert any DomainError thrown from services / repositories into the
// matching ActionError. Always wrap the outermost handler so the frontend
// gets a consistent error envelope.
export function catchDomain<I, O>(handler: Handler<I, O>): Handler<I, O> {
  return async (input, ctx) => {
    try {
      return await handler(input, ctx)
    } catch (err) {
      throw toActionError(err)
    }
  }
}

export function withSession<I, O>(handler: Handler<I, O>): Handler<I, O> {
  return async (input, ctx) => {
    if (ctx.session === undefined) {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: ErrorMessages.SESSION_NOT_CONFIGURED,
      })
    }
    return handler(input, ctx)
  }
}

export function withAdmin<I, O>(handler: Handler<I, O>, message?: string): Handler<I, O> {
  return withSession(async (input, ctx) => {
    if (!(await isAdmin(ctx.session))) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: message ?? ErrorMessages.NOT_ADMIN })
    }
    return handler(input, ctx)
  })
}

export function withCsrf<I extends { token: string }, O>(handler: Handler<I, O>): Handler<I, O> {
  return withSession(async (input, ctx) => {
    const [valid, error] = await validateToken(ctx.session!, input.token)
    if (!valid) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: error })
    }
    return handler(input, ctx)
  })
}

interface RateLimitOptions {
  /** Identifier strategy. Currently only IP. */
  key: 'ip'
  /** Message used when the limit is exceeded. */
  message?: string
  /** Should we increment the counter on a thrown error? Defaults to true. */
  incrementOnError?: boolean
}

export function withRateLimit<I, O>(options: RateLimitOptions, handler: Handler<I, O>): Handler<I, O> {
  return async (input, ctx) => {
    const id = ctx.clientAddress
    if (await exceedLimit(id)) {
      throw new ActionError({
        code: 'TOO_MANY_REQUESTS',
        message: options.message ?? ErrorMessages.TOO_MANY_REQUESTS,
      })
    }
    try {
      return await handler(input, ctx)
    } catch (err) {
      if (options.incrementOnError ?? true) {
        await incrLimit(id)
      }
      throw err
    }
  }
}

export function userFromCtx(ctx: ActionAPIContext) {
  return userSession(ctx.session)
}
