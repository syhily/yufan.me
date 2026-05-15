import type { Context } from 'hono'

import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import { getLogger } from '@/server/logger'
import { DomainError, domainStatus } from '@/server/route-helpers/errors'

import type { Env } from './context'

const log = getLogger('http.error')

function json(c: Context<Env>, body: any, status: number): Response {
  return c.json(body, status as any)
}

export function onErrorHandler(err: Error, c: Context<Env>): Response {
  if (err instanceof HTTPException) {
    const payload = {
      error: {
        message: err.message,
        issues: err.cause as { message: string; path?: string[] }[] | undefined,
      },
    }
    return json(c, payload, err.status)
  }

  if (err instanceof DomainError) {
    return json(c, { error: { message: err.message } }, domainStatus(err))
  }

  if (err instanceof ZodError) {
    return json(
      c,
      {
        error: {
          message: '输入数据无效',
          issues: err.issues.map((i) => ({ message: i.message, path: i.path.map(String) })),
        },
      },
      400,
    )
  }

  log.error('unexpected', { requestId: c.var.requestId, error: err })
  c.header('X-Request-Id', c.var.requestId)
  return json(c, { error: { message: '服务器内部错误' } }, 500)
}
