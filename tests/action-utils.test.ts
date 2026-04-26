import { describe, expect, it } from 'vite-plus/test'
import { z } from 'zod'

import { fail, ok, parseInput } from '@/server/route-helpers/api-handler'
import { ActionFailure, DomainError, domainStatus } from '@/server/route-helpers/errors'

// Pure-function safety net for the API plumbing. These helpers are called by
// every Resource Route via `runApi`; any regression here would silently
// corrupt every JSON response.
describe('routes/_shared/api/handler — response helpers', () => {
  it('ok() wraps payload in `{ data }` envelope', async () => {
    const response = ok({ message: 'hi' })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    const body = await response.json()
    expect(body).toEqual({ data: { message: 'hi' } })
  })

  it('fail() preserves status and serialises issues', async () => {
    const response = fail(422, 'bad', [{ message: 'must be int', path: ['rid'] }])
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body).toEqual({
      error: { message: 'bad', issues: [{ message: 'must be int', path: ['rid'] }] },
    })
  })

  it('fail() forwards headers for consumed CSRF/session state', async () => {
    const response = fail(403, 'csrf', undefined, { 'Set-Cookie': 'blog_session=stub' })
    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBe('blog_session=stub')
  })

  it('parseInput throws an ActionFailure with translated zod issues', async () => {
    const schema = z.object({ rid: z.string() })
    await expect(parseInput(schema, { rid: 123 })).rejects.toBeInstanceOf(ActionFailure)
  })

  it('parseInput returns the parsed value on success', async () => {
    const schema = z.object({ rid: z.string() })
    await expect(parseInput(schema, { rid: 'abc' })).resolves.toEqual({ rid: 'abc' })
  })

  it('domainStatus maps every DomainError code to a stable HTTP status', () => {
    expect(domainStatus(new DomainError('BAD_REQUEST', 'x'))).toBe(400)
    expect(domainStatus(new DomainError('UNAUTHORIZED', 'x'))).toBe(401)
    expect(domainStatus(new DomainError('FORBIDDEN', 'x'))).toBe(403)
    expect(domainStatus(new DomainError('NOT_FOUND', 'x'))).toBe(404)
    expect(domainStatus(new DomainError('CONFLICT', 'x'))).toBe(409)
    expect(domainStatus(new DomainError('RATE_LIMITED', 'x'))).toBe(429)
    expect(domainStatus(new DomainError('INTERNAL', 'x'))).toBe(500)
  })

  it('DomainError without an explicit message falls back to the per-code default', () => {
    // Lets services throw `new DomainError("CONFLICT")` for the common case
    // without re-typing the same translated copy at every throw site.
    expect(new DomainError('FORBIDDEN').message).toBe('禁止访问。')
    expect(new DomainError('RATE_LIMITED').message).toBe('请求过于频繁，请稍后再试。')
    expect(new DomainError('INTERNAL', 'custom').message).toBe('custom')
  })
})
