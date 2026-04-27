import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { emptySession } from './_helpers/session'

// `signInWithSession` is the single entry-point both the public admin login
// route and integration-style harnesses use to authenticate. We pin the two
// behavioural guarantees that are easy to silently regress:
//
//   1. The successful response carries BOTH a `__session` cookie (so the
//      browser persists the new login) AND a rotated `csrf-token` cookie
//      (so any concurrently-open admin tab picks up a fresh, session-bound
//      token without having to re-fetch the form).
//   2. The rate limiter only round-trips Redis once per attempt (the
//      legacy `exceedLimit` + `incrLimit` pair was collapsed into
//      `tryRateLimit`).

// Stub Redis: the cookie-backed `createSessionStorage` writes the encrypted
// session id to Redis on commit and reads it back for `getSession`. The
// flow test only cares about the Set-Cookie surface, so a no-op Redis is
// enough; we do *not* mock `commitSession` itself, because the merged
// `signInWithSession` (in the same module) would still see the real export
// — `vi.mock` only swaps the module's *named* exports, not internal calls.
vi.mock('@/server/cache/storage', () => ({
  redisInstance: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
  }),
}))

vi.mock('@/server/db/query/user', () => ({
  hasAdmin: vi.fn(async () => false),
  insertAdmin: vi.fn(async () => []),
  verifyUserPassword: vi.fn(),
  updateLastLogin: vi.fn(async () => undefined),
}))

vi.mock('@/server/rate-limit', () => ({
  tryRateLimit: vi.fn(async () => ({ count: 1, exceeded: false })),
  LIMIT_THRESHOLD: 5,
}))

const userQuery = await import('@/server/db/query/user')
const rateLimit = await import('@/server/rate-limit')
const { issueCsrfToken, signInWithSession } = await import('@/server/session')

const verifyUserPasswordMock = vi.mocked(userQuery.verifyUserPassword)

beforeEach(() => {
  verifyUserPasswordMock.mockReset()
  vi.mocked(rateLimit.tryRateLimit).mockReset()
  vi.mocked(rateLimit.tryRateLimit).mockResolvedValue({ count: 1, exceeded: false })
})

function setCookieHeaders(headers: HeadersInit): string[] {
  if (headers instanceof Headers) {
    return headers.getSetCookie()
  }
  // Plain-object header path is used only on the empty-CSRF code branch;
  // surface it as a single-element array for symmetric test assertions.
  const value = (headers as Record<string, string>)['Set-Cookie']
  return value ? [value] : []
}

async function buildSignedRequest(token: string): Promise<{ request: Request; token: string }> {
  const issued = token === '' ? await issueCsrfToken() : { token, setCookie: '' }
  const cookie = issued.setCookie === '' ? '' : issued.setCookie.split(';')[0]!
  const request = new Request('http://localhost/wp-login.php', {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
  })
  return { request, token: issued.token }
}

// `login()` reads the password through `verifyUserPassword`. Returning a
// non-null record makes `login()` resolve `true`, returning `null` makes it
// resolve `false` — without us having to spy on `login` itself.
const stubUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@yufan.me',
  link: null,
  isAdmin: true,
} as never

describe('services/auth/flow — signInWithSession', () => {
  it('on success emits both a session cookie and a freshly-rotated CSRF cookie', async () => {
    verifyUserPasswordMock.mockResolvedValue(stubUser)
    const { request, token } = await buildSignedRequest('')

    const result = await signInWithSession({
      email: 'admin@yufan.me',
      password: 'correct horse',
      token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
      redirectTo: '/',
    })

    expect(result.ok).toBe(true)
    const cookies = setCookieHeaders(result.headers)
    // Two distinct cookies must travel back: the session one and the
    // rotated CSRF one. `getSetCookie()` preserves them as separate values
    // (a plain-object header would silently overwrite), which is exactly
    // why the success path constructs a `Headers` instance.
    expect(cookies.some((c) => c.startsWith('__session='))).toBe(true)
    expect(cookies.some((c) => c.startsWith('csrf-token='))).toBe(true)
    // The new CSRF cookie carries a non-empty value (a `clearCsrfCookie`
    // regression would emit `csrf-token=; Max-Age=0`).
    const csrf = cookies.find((c) => c.startsWith('csrf-token='))!
    const value = csrf.split(';')[0].split('=')[1]
    expect(value.length).toBeGreaterThan(10)
    expect(csrf).toMatch(/HttpOnly/i)
    expect(csrf).toMatch(/SameSite=Lax/i)
  })

  it('only round-trips Redis once per attempt (no separate exceedLimit GET)', async () => {
    verifyUserPasswordMock.mockResolvedValue(stubUser)
    const { request, token } = await buildSignedRequest('')

    await signInWithSession({
      email: 'admin@yufan.me',
      password: 'correct horse',
      token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
      redirectTo: '/',
    })

    expect(rateLimit.tryRateLimit).toHaveBeenCalledTimes(1)
    expect(rateLimit.tryRateLimit).toHaveBeenCalledWith('127.0.0.1')
  })

  it('returns 429 (and never invokes login) when the rate limiter trips', async () => {
    vi.mocked(rateLimit.tryRateLimit).mockResolvedValue({ count: 99, exceeded: true })
    const { request, token } = await buildSignedRequest('')

    const result = await signInWithSession({
      email: 'admin@yufan.me',
      password: 'correct horse',
      token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
      redirectTo: '/',
    })

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.status).toBe(429)
    }
    expect(verifyUserPasswordMock).not.toHaveBeenCalled()
  })

  it('returns 403 with no rotated CSRF cookie on bad credentials', async () => {
    verifyUserPasswordMock.mockResolvedValue(null)
    const { request, token } = await buildSignedRequest('')

    const result = await signInWithSession({
      email: 'admin@yufan.me',
      password: 'wrong',
      token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
      redirectTo: '/',
    })

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.status).toBe(403)
    }
    const cookies = setCookieHeaders(result.headers)
    expect(cookies.some((c) => c.startsWith('csrf-token='))).toBe(false)
  })
})
