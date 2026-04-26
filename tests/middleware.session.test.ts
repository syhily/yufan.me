import { RouterContextProvider } from 'react-router'
import { describe, expect, it, vi } from 'vite-plus/test'

// Mock Redis so the cookie-backed session storage doesn't reach a live
// instance. `sessionMiddleware` lives in the same module as
// `resolveSessionContext`, so we can't `vi.spyOn` the resolver directly —
// the middleware closes over a local reference. Instead, we stub the
// underlying primitives (Redis + storage); the resolver still runs once
// per request, which is what we ultimately want to assert.
const redisGetMock = vi.fn(async () => null)
vi.mock('@/server/cache/storage', () => ({
  redisInstance: () => ({
    get: redisGetMock,
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
  }),
}))

const { sessionMiddleware, requestContext, sessionContext, getRouteRequestContext } = await import('@/server/session')

// `RouterContextProvider` is the in-process container that React Router uses
// to share per-request values between the middleware perimeter and the
// loaders/actions. The asserts below simulate a single navigation: the
// middleware runs once, then several loaders / `runApi` calls read the
// already-resolved session via `getRouteRequestContext` instead of each
// re-decrypting the cookie.
describe('middleware: sessionMiddleware perimeter', () => {
  it('resolves the session exactly once per request, even when multiple loaders read it', async () => {
    const request = new Request('http://localhost/posts/hello', {
      headers: { Cookie: '__session=abc' },
    })
    const context = new RouterContextProvider()
    redisGetMock.mockClear()

    let next!: () => Promise<Response>
    const nextSpy = vi.fn(async () => new Response('ok'))
    next = nextSpy

    await sessionMiddleware({ request, context, params: {} } as never, next)

    // Both helpers populated.
    expect(() => context.get(sessionContext)).not.toThrow()
    expect(() => context.get(requestContext)).not.toThrow()

    const redisCallsAfterMiddleware = redisGetMock.mock.calls.length

    // Now simulate three different loaders reading the context (e.g. root +
    // post.detail loader + a runApi call inside an action). The middleware
    // already populated the context, so subsequent reads must not redecrypt
    // the cookie or hit Redis again.
    const a = getRouteRequestContext({ request, context })
    const b = getRouteRequestContext({ request, context })
    const c = getRouteRequestContext({ request, context })

    expect(redisGetMock.mock.calls.length).toBe(redisCallsAfterMiddleware)

    // All loaders see the same identity-stable session/admin/url shape.
    expect(a.admin).toBe(false)
    expect(a.session).toBe(b.session)
    expect(a.session).toBe(c.session)
    expect(a.url.pathname).toBe('/posts/hello')
    expect(a.clientAddress).toBeTypeOf('string')
    expect(nextSpy).toHaveBeenCalledTimes(1)
  })

  it('requires the context populated by sessionMiddleware (no silent fallback)', () => {
    const request = new Request('http://localhost/')
    const emptyContext = new RouterContextProvider()
    // The context has neither sessionContext nor requestContext set: any
    // direct route handler invocation that bypasses the middleware should
    // surface that mistake immediately rather than silently re-decrypting
    // the cookie. Tests that need a populated context use
    // `tests/_helpers/context.ts` (`makeRouteContext` / `makeLoaderArgs`).
    expect(() => getRouteRequestContext({ request, context: emptyContext })).toThrow()
  })
})
