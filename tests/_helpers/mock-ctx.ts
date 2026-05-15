import type { AuthedHandlerContext, HandlerContext } from '@/server/http/ts-rest-adapter'

// Builders for the `ctx` argument every controller takes. The full
// `HandlerContext` shape pulls in Hono's session helper, so we cast
// through `unknown` once here and keep the rest of the test files
// focused on the controller logic.

export interface MockCtxOptions {
  userId?: string
  role?: 'admin' | 'author' | 'visitor'
  sessionId?: string
  clientAddress?: string
  url?: string
}

export function makeAuthedCtx(opts: MockCtxOptions = {}): AuthedHandlerContext {
  const userId = opts.userId ?? '1'
  const role = opts.role ?? 'admin'
  return {
    request: new Request(opts.url ?? 'http://localhost/api'),
    session: {
      id: opts.sessionId ?? 'session-1',
      get: () => undefined,
      set: () => undefined,
      unset: () => undefined,
      flash: () => undefined,
    } as unknown as AuthedHandlerContext['session'],
    viewer: { userId, role },
    clientAddress: opts.clientAddress ?? '127.0.0.1',
  }
}

export function makePublicCtx(opts: MockCtxOptions = {}): HandlerContext {
  return {
    ...makeAuthedCtx(opts),
    viewer: null,
  }
}
