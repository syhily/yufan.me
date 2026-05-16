import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vite-plus/test'

import type { Env } from '@/server/http/context'

import { onErrorHandler } from '@/server/http/errors'

// `csrfGuard` reads from `X-CSRF-Token` header (preferred) and falls
// back to `csrf` field in JSON/url-encoded body. Tests stub the
// auth/csrf primitives so we exercise the middleware logic alone.

vi.mock('@/server/auth/csrf', async () => {
  return {
    validateRequestCsrf: async (_req: Request, token: string | undefined): Promise<[boolean, string]> => {
      if (token === 'good-token') {
        return [true, '']
      }
      return [false, 'bad token']
    },
    clearCsrfCookie: async () => 'csrf=; Max-Age=0',
  }
})

async function createApp(): Promise<Hono<Env>> {
  const { csrfGuard } = await import('@/server/http/middlewares/csrf')
  const app = new Hono<Env>()
  app.onError(onErrorHandler)
  // Echo back the body as JSON; mirrors how the RPC handler would
  // accept POSTs once it gets past CSRF.
  app.use('*', csrfGuard)
  app.get('/ping', (c) => c.json({ ok: true }))
  app.post('/echo', async (c) => {
    const body = (await c.req.json()) as { message: string }
    return c.json({ received: body.message })
  })
  return app
}

describe('csrfGuard', () => {
  it('lets GET through without a token', async () => {
    const app = await createApp()
    const res = await app.request('/ping')
    expect(res.status).toBe(200)
  })

  it('accepts a token in the X-CSRF-Token header', async () => {
    const app = await createApp()
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'good-token' },
      body: JSON.stringify({ message: 'hi' }),
    })
    expect(res.status).toBe(200)
  })

  it('falls back to `csrf` field in the body when header is absent', async () => {
    const app = await createApp()
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi', csrf: 'good-token' }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects with 403 when no token is supplied at all', async () => {
    const app = await createApp()
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    })
    expect(res.status).toBe(403)
    expect(res.headers.get('Set-Cookie')).toContain('csrf=')
  })

  it('rejects with 403 when the token is wrong', async () => {
    const app = await createApp()
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'wrong-token' },
      body: JSON.stringify({ message: 'hi' }),
    })
    expect(res.status).toBe(403)
  })
})
