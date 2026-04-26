import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { issueCsrfToken, validateRequestCsrf } from '@/server/session'
import { encodedEmail, makeToken, timingSafeEqual } from '@/shared/security'

import { adminSession, makeSession, regularSession } from './_helpers/session'

function requestWithCookie(setCookie: string): Request {
  // Strip everything after the value (no `Path`, `Max-Age`, etc.) so the
  // mock request looks like a real browser round-trip.
  const cookie = setCookie.split(';')[0]!
  return new Request('http://localhost/wp-login.php', {
    headers: { Cookie: cookie },
  })
}

describe('services/auth/csrf — issue/validate (double-submit cookie)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('issueCsrfToken returns a token plus a Set-Cookie header that pins it', async () => {
    const { token, setCookie } = await issueCsrfToken()
    expect(token.length).toBeGreaterThan(0)
    expect(setCookie).toContain('csrf-token=')
    expect(setCookie).toContain('Max-Age=')
    // Locking down the cookie attributes via assertion so a future refactor
    // can't quietly drop HttpOnly / weaken SameSite. `Secure` is gated on
    // `import.meta.env.PROD`, so we don't assert it here (test env runs as
    // DEV by default and would otherwise be brittle to flag flips).
    expect(setCookie).toMatch(/SameSite=Lax/i)
    expect(setCookie).toMatch(/HttpOnly/i)
  })

  it('validateRequestCsrf accepts a request whose cookie matches the form field', async () => {
    const { token, setCookie } = await issueCsrfToken()
    const result = await validateRequestCsrf(requestWithCookie(setCookie), token)
    expect(result).toEqual([true, ''])
  })

  it('validateRequestCsrf rejects mismatched form tokens', async () => {
    const { setCookie } = await issueCsrfToken()
    const [ok, message] = await validateRequestCsrf(requestWithCookie(setCookie), 'wrong-token')
    expect(ok).toBe(false)
    expect(message).toContain('mismatch')
  })

  it('validateRequestCsrf rejects requests with no CSRF cookie', async () => {
    const { token } = await issueCsrfToken()
    const [ok, message] = await validateRequestCsrf(new Request('http://localhost/wp-login.php'), token)
    expect(ok).toBe(false)
    expect(message).toMatch(/Missing or expired CSRF cookie/)
  })

  it('validateRequestCsrf rejects an empty form field even when the cookie is present', async () => {
    const { setCookie } = await issueCsrfToken()
    const [ok, message] = await validateRequestCsrf(requestWithCookie(setCookie), '')
    expect(ok).toBe(false)
    expect(message).toMatch(/Missing CSRF token in form submission/)
  })
})

describe('services/auth/session — userSession / isAdmin', () => {
  it('userSession returns the stored user payload (no nullable wrappers)', async () => {
    const { userSession, isAdmin } = await import('@/server/session')
    const admin = adminSession()
    expect(userSession(admin)?.email).toBe('admin@yufan.me')
    expect(isAdmin(admin)).toBe(true)
  })

  it('isAdmin is false when the user is non-admin', async () => {
    const { isAdmin } = await import('@/server/session')
    expect(isAdmin(regularSession())).toBe(false)
  })

  it('isAdmin is false when the session has no user attached', async () => {
    const { isAdmin } = await import('@/server/session')
    expect(isAdmin(makeSession())).toBe(false)
  })
})

describe('shared/security primitives', () => {
  it('makeToken produces base64url strings of the requested length', () => {
    const token = makeToken(32)
    expect(token).toHaveLength(32)
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true)
  })

  it('encodedEmail normalises case and trims whitespace before hashing', async () => {
    const a = await encodedEmail('Foo@Example.COM')
    const b = await encodedEmail('  foo@example.com  ')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('timingSafeEqual is true only for equal inputs', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})
