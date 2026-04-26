import { describe, expect, it } from 'vite-plus/test'
import { z } from 'zod'

import type { BlogSession } from '@/server/session'

import {
  assertMethod,
  readJsonInput,
  readSearchInput,
  requireAdminSession,
  runApi,
} from '@/server/route-helpers/api-handler'
import { ActionFailure, DomainError, ErrorMessages } from '@/server/route-helpers/errors'

import { makeLoaderArgs } from './_helpers/context'

// `runApi` is the single perimeter shared by every Resource Route. The tests
// below exercise its happy path, both error-translation branches
// (`ActionFailure`, `DomainError`), envelope unwrapping, raw `Response`
// pass-through, and the input-parsing helpers.

const jsonRequest = (method: string, body: unknown) =>
  new Request('http://localhost/api/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// `runApi` now requires the React Router `RouterContextProvider` shape that
// `sessionMiddleware` populates in production. Tests use `makeLoaderArgs` to
// construct the same context without booting the middleware stack.
const apiArgs = (request: Request = new Request('http://localhost/api/test')) => makeLoaderArgs({ request })

describe('routes/_shared/api/handler — runApi perimeter', () => {
  it('runApi wraps the handler return value in a `{ data }` envelope', async () => {
    const response = await runApi(apiArgs(), () => ({
      hello: 'world',
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { hello: 'world' } })
  })

  it('runApi unwraps explicit envelopes and forwards headers', async () => {
    const response = await runApi(apiArgs(), () => ({
      data: { ok: 1 },
      headers: { 'X-Custom': 'yes' },
    }))
    expect(response.headers.get('X-Custom')).toBe('yes')
    expect(await response.json()).toEqual({ data: { ok: 1 } })
  })

  it('runApi passes raw `Response` results through unchanged', async () => {
    const raw = new Response('plain', { status: 201 })
    const response = await runApi(apiArgs(), () => raw)
    expect(response).toBe(raw)
  })

  it('runApi translates ActionFailure into the standard error envelope', async () => {
    const response = await runApi(apiArgs(), () => {
      throw new ActionFailure(404, 'missing', [{ message: 'gone', path: ['rid'] }])
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: { message: 'missing', issues: [{ message: 'gone', path: ['rid'] }] },
    })
  })

  it('runApi forwards ActionFailure headers', async () => {
    const response = await runApi(apiArgs(), () => {
      throw new ActionFailure(403, 'csrf', undefined, { 'Set-Cookie': 'blog_session=stub' })
    })
    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBe('blog_session=stub')
    expect(await response.json()).toEqual({ error: { message: 'csrf' } })
  })

  it('runApi translates DomainError using its mapped HTTP status', async () => {
    const response = await runApi(apiArgs(), () => {
      throw new DomainError('NOT_FOUND', 'who?')
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: { message: 'who?' } })
  })

  it('runApi returns a generic 500 envelope without leaking error.message', async () => {
    const response = await runApi(apiArgs(), () => {
      throw new Error('boom: select * from users where id=1')
    })
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error.message).toBe('服务器内部错误')
    expect(body.error.message).not.toContain('boom')
    expect(response.headers.get('X-Request-Id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('readJsonInput validates and returns the typed payload', async () => {
    const schema = z.object({ rid: z.string() })
    const value = await readJsonInput(jsonRequest('POST', { rid: 'abc' }), schema)
    expect(value).toEqual({ rid: 'abc' })
  })

  it('readJsonInput rejects malformed JSON via ActionFailure(400)', async () => {
    const request = new Request('http://localhost/api/test', { method: 'POST', body: 'not-json' })
    const schema = z.object({ rid: z.string() })
    await expect(readJsonInput(request, schema)).rejects.toBeInstanceOf(ActionFailure)
  })

  it('readSearchInput collects URL search params and validates them', async () => {
    const url = new URL('http://localhost/api/test?offset=12&page_key=hi')
    const schema = z.object({ page_key: z.string(), offset: z.coerce.number() })
    await expect(readSearchInput(url, schema)).resolves.toEqual({ offset: 12, page_key: 'hi' })
  })

  it('assertMethod throws ActionFailure(405) on disallowed methods', () => {
    expect(() => assertMethod(new Request('http://localhost/api/test', { method: 'GET' }), 'POST')).toThrow(
      ActionFailure,
    )
  })

  it('assertMethod is a no-op for allowed methods', () => {
    expect(() => assertMethod(new Request('http://localhost/api/test', { method: 'POST' }), 'POST')).not.toThrow()
  })

  it('requireAdminSession reuses the session object runApi already resolved', () => {
    const session = {
      get: (key: string) => (key === 'user' ? { admin: true } : undefined),
    } as BlogSession

    expect(requireAdminSession(session)).toBe(session)
  })

  it('requireAdminSession keeps admin failures in the standard error envelope', async () => {
    const response = await runApi(apiArgs(), ({ session }) => {
      requireAdminSession(session)
      return { ok: true }
    })

    // 403 (not 401) — the visitor *is* authenticated, they just aren't an
    // admin. Returning 401 would invite browsers to retry with credentials.
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: { message: ErrorMessages.NOT_ADMIN },
    })
  })
})
