// Single Hono `onError` translator. Maps every kind of error a
// controller (or middleware) might throw to the unified JSON
// envelope declared in `shared/contracts/_errors.ts`.
//
// `DomainError` + `domainStatus` are reused verbatim from
// `server/route-helpers/errors.ts` so service-layer error
// vocabulary stays intact during the migration.

import type { Context } from 'hono'

import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import type { Env } from '@/server/http/context'

import { getLogger } from '@/server/logger'
import { ActionFailure, DomainError, domainStatus } from '@/server/route-helpers/errors'

const log = getLogger('http.error')

interface ErrorBody {
  error: {
    message: string
    issues?: { message: string; path?: string[] }[]
  }
}

// Hono's `onError` callback signature. Always returns a Response.
export function onErrorHandler(err: Error, c: Context<Env>): Response {
  if (err instanceof HTTPException) {
    const issues = Array.isArray(err.cause) ? (err.cause as { message: string; path?: string[] }[]) : undefined
    const body: ErrorBody = { error: { message: err.message, issues } }
    return c.json(body, err.status)
  }

  if (err instanceof ActionFailure) {
    const body: ErrorBody = { error: { message: err.message, issues: err.issues } }
    // `ActionFailure.status` is `number`; cast to Hono's accepted union.
    // The status set comes from real call sites: 400/401/403/404/409/413/429/500.
    return c.json(body, err.status as 400)
  }

  if (err instanceof DomainError) {
    const body: ErrorBody = { error: { message: err.message } }
    return c.json(body, domainStatus(err) as 400)
  }

  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        message: '输入数据无效',
        issues: err.issues.map((i) => ({
          message: i.message,
          path: i.path.map(String),
        })),
      },
    }
    return c.json(body, 400)
  }

  const requestId = c.var.requestId ?? crypto.randomUUID()
  log.error('unexpected', { requestId, error: err })
  c.header('X-Request-Id', requestId)
  return c.json({ error: { message: '服务器内部错误' } }, 500)
}
