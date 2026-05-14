import type { Context } from 'hono'

import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import { getLogger } from '@/server/logger'
import { DomainError, domainStatus } from '@/server/route-helpers/errors'

import type { Env } from './context'

const log = getLogger('http.error')

export function onErrorHandler(err: Error, c: Context<Env>): Response {
  if (err instanceof HTTPException) {
    const payload = {
      error: {
        message: err.message,
        issues: err.cause as { message: string; path?: string[] }[] | undefined,
      },
    }
    return c.json(payload, err.status as any)
  }

  if (err instanceof DomainError) {
    return c.json({ error: { message: err.message } }, domainStatus(err) as any)
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          message: '输入数据无效',
          issues: err.issues.map((i) => ({ message: i.message, path: i.path.map(String) })),
        },
      },
      400,
    )
  }

  const requestId = c.var.requestId
  log.error('unexpected', { requestId, error: err })
  c.header('X-Request-Id', requestId)
  return c.json({ error: { message: '服务器内部错误' } }, 500)
}
