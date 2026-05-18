import { describe, expect, it } from 'vite-plus/test'

import { clearCsrfCookie, issueCsrfToken, reuseOrIssueCsrfToken, validateRequestCsrf } from '@/server/domains/auth/csrf'

describe('issueCsrfToken', () => {
  it('returns a 48-char token and a Set-Cookie header', async () => {
    const { token, setCookie } = await issueCsrfToken()
    expect(token).toHaveLength(48)
    expect(setCookie).toContain('csrf-token=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })

  it('marks the cookie Secure when the request is HTTPS', async () => {
    const req = new Request('https://example.test/rpc')
    const { setCookie } = await issueCsrfToken(req)
    expect(setCookie).toContain('Secure')
  })

  it('omits Secure when the request is HTTP', async () => {
    const req = new Request('http://localhost:4321/rpc')
    const { setCookie } = await issueCsrfToken(req)
    expect(setCookie).not.toContain('Secure')
  })
})

describe('reuseOrIssueCsrfToken', () => {
  it('reuses an existing cookie when present and valid', async () => {
    const first = await issueCsrfToken()
    const req = new Request('http://localhost/rpc', {
      headers: { Cookie: first.setCookie.split(';')[0] },
    })
    const reused = await reuseOrIssueCsrfToken(req)
    expect(reused.token).toBe(first.token)
    expect(reused.setCookie).toBe('')
  })

  it('issues a fresh token when the cookie is missing', async () => {
    const req = new Request('http://localhost/rpc')
    const issued = await reuseOrIssueCsrfToken(req)
    expect(issued.token).toHaveLength(48)
    expect(issued.setCookie).not.toBe('')
  })
})

describe('validateRequestCsrf', () => {
  it('accepts a matching token + cookie pair', async () => {
    const { token, setCookie } = await issueCsrfToken()
    const req = new Request('http://localhost/rpc', {
      headers: { Cookie: setCookie.split(';')[0] },
    })
    const [ok] = await validateRequestCsrf(req, token)
    expect(ok).toBe(true)
  })

  it('rejects when the form token is missing', async () => {
    const req = new Request('http://localhost/rpc')
    const [ok, reason] = await validateRequestCsrf(req, undefined)
    expect(ok).toBe(false)
    expect(reason).toContain('Missing CSRF token')
  })

  it('rejects when the cookie is missing', async () => {
    const req = new Request('http://localhost/rpc')
    const [ok, reason] = await validateRequestCsrf(req, 'some-token')
    expect(ok).toBe(false)
    expect(reason).toContain('Missing or expired CSRF cookie')
  })

  it('rejects when token and cookie do not match', async () => {
    const { setCookie } = await issueCsrfToken()
    const req = new Request('http://localhost/rpc', {
      headers: { Cookie: setCookie.split(';')[0] },
    })
    const [ok, reason] = await validateRequestCsrf(req, 'wrong-token')
    expect(ok).toBe(false)
    expect(reason).toContain('mismatch')
  })
})

describe('clearCsrfCookie', () => {
  it('returns a Set-Cookie that expires the cookie immediately', async () => {
    const header = await clearCsrfCookie()
    expect(header).toContain('csrf-token=')
    expect(header).toContain('Max-Age=0')
  })
})
