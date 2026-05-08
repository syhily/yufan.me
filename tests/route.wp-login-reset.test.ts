import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// Covers RBAC-RECTIFICATION-PLAN §1.2.
//
// The `wp-login` action's password-reset and author-invite branches
// share two non-negotiable invariants:
//
//   1. The CSRF token MUST be validated. The reset link is a bearer
//      token leaked over email; without CSRF a malicious page could
//      submit it cross-origin.
//   2. After a successful password rotation, ALL other sessions of the
//      target user MUST be revoked — `establishLoginSession` is called
//      with `{ revokeOtherSessions: true }` so a stolen cookie cannot
//      survive the recovery flow.
//
// We exercise the action with three scenarios that pin both invariants
// in place.

const state = vi.hoisted(() => {
  const store = new Map<string, unknown>()
  return {
    session: {
      get(key: string) {
        return store.get(key)
      },
      set(key: string, value: unknown) {
        store.set(key, value)
      },
      unset(key: string) {
        store.delete(key)
      },
    },
  }
})

const sessionMocks = vi.hoisted(() => ({
  validateRequestCsrf: vi.fn(),
  clearCsrfCookie: vi.fn(async () => 'csrf=; Path=/; Max-Age=0'),
  commitSession: vi.fn(async () => 'blog_session=stub'),
  destroySession: vi.fn(async () => 'blog_session=deleted'),
}))

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    commitSession: sessionMocks.commitSession,
    destroySession: sessionMocks.destroySession,
    validateRequestCsrf: sessionMocks.validateRequestCsrf,
    clearCsrfCookie: sessionMocks.clearCsrfCookie,
    getRouteRequestContext: vi.fn(({ request }: { request: Request }) => ({
      session: state.session,
      user: undefined,
      admin: false,
      clientAddress: '203.0.113.7',
      url: new URL(request.url),
    })),
    processAuthFormSubmission: vi.fn(async () => ({ ok: true })),
  }
})

vi.mock('@/server/install/gate', () => ({
  ensureInstalledOrRedirect: vi.fn(async () => null),
  ensureNoAdminOrRedirect: vi.fn(async () => null),
  ensureNoSettingsOrRedirect: vi.fn(async () => null),
  isInstalled: vi.fn(async () => true),
  getInstallState: vi.fn(async () => 'installed' as const),
}))

const authPrimitivesMocks = vi.hoisted(() => ({
  establishLoginSession: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
  login: vi.fn(async () => undefined),
}))

vi.mock('@/server/auth/primitives', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/primitives')>('@/server/auth/primitives')
  return {
    ...actual,
    establishLoginSession: authPrimitivesMocks.establishLoginSession,
    logout: authPrimitivesMocks.logout,
    login: authPrimitivesMocks.login,
  }
})

const tokenMocks = vi.hoisted(() => ({
  consumeToken: vi.fn(),
  peekToken: vi.fn(async () => null),
  issueResetToken: vi.fn(async () => ({ token: 'tok-test' })),
}))

vi.mock('@/server/auth/verification-tokens', () => tokenMocks)

const userQueryMocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  updateUserById: vi.fn(async () => ({ id: 42n })),
  findUserByEmail: vi.fn(async () => null),
}))

vi.mock('@/server/db/query/user', () => userQueryMocks)

vi.mock('@/server/db/query/comment', () => ({
  countApprovedCommentsByUser: vi.fn(async () => 0),
}))

vi.mock('@/server/email/sender', () => ({
  sendPasswordReset: vi.fn(async () => undefined),
}))

vi.mock('@/server/rate-limit', () => ({
  tryPasswordResetRateLimit: vi.fn(async () => ({ count: 1, exceeded: false })),
  tryPasswordResetByEmailRateLimit: vi.fn(async () => ({ count: 1, exceeded: false })),
}))

const { action } = await import('@/routes/wp-login')

function resetRequest(body: Record<string, string>): Request {
  return new Request('http://localhost/wp-login.php?action=resetpassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: CSRF valid; tests opt out individually.
  sessionMocks.validateRequestCsrf.mockResolvedValue([true, null] as never)
  tokenMocks.consumeToken.mockResolvedValue(null)
  userQueryMocks.findUserById.mockResolvedValue(null)
})

async function readActionData<T>(promise: Promise<unknown>): Promise<T> {
  const result = (await promise) as { data: T } | T
  if (result !== null && typeof result === 'object' && 'data' in (result as object)) {
    return (result as { data: T }).data
  }
  return result as T
}

describe('routes/wp-login — password-reset CSRF + session-revocation', () => {
  it('returns the CSRF error and never touches the session when validateRequestCsrf fails', async () => {
    sessionMocks.validateRequestCsrf.mockResolvedValueOnce([false, 'missing'] as never)
    const result = await readActionData<{ error: string | null }>(
      action({
        request: resetRequest({ csrf: 'bad', reset_token: 'rt', password: 'longenough' }),
      } as never),
    )
    expect(result.error).toBe('页面安全令牌已失效，请刷新后重试。')
    expect(authPrimitivesMocks.establishLoginSession).not.toHaveBeenCalled()
    expect(tokenMocks.consumeToken).not.toHaveBeenCalled()
  })

  it('returns 链接无效或已过期 when consumeToken yields null (no session established)', async () => {
    tokenMocks.consumeToken.mockResolvedValueOnce(null)
    const result = await readActionData<{ error: string | null }>(
      action({
        request: resetRequest({ csrf: 'good', reset_token: 'rt', password: 'longenough' }),
      } as never),
    )
    expect(result.error).toBe('链接无效或已过期。')
    expect(authPrimitivesMocks.establishLoginSession).not.toHaveBeenCalled()
  })

  it('calls establishLoginSession with revokeOtherSessions: true on a successful reset', async () => {
    tokenMocks.consumeToken.mockResolvedValueOnce({ userId: 42n })
    userQueryMocks.findUserById.mockResolvedValueOnce({
      id: 42n,
      role: 'visitor',
      name: 'tester',
      email: 'tester@example.com',
      password: 'hash',
    })

    // Action returns a redirect Response on success; both `data(...)` and
    // `redirect(...)` flow through the same call surface.
    let caught: unknown
    try {
      await action({
        request: resetRequest({ csrf: 'good', reset_token: 'rt', password: 'longenough' }),
      } as never)
    } catch (error) {
      caught = error
    }
    // Whichever path it took, the security invariant is the same:
    expect(authPrimitivesMocks.establishLoginSession).toHaveBeenCalledTimes(1)
    const callArgs = authPrimitivesMocks.establishLoginSession.mock.calls[0]!
    // Last positional arg is `{ revokeOtherSessions: true }`.
    expect(callArgs[callArgs.length - 1]).toEqual({ revokeOtherSessions: true })
    // Make TS happy about the unused capture.
    void caught
  })
})
