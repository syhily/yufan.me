import type { MiddlewareFunction } from 'react-router'

import { RouterContextProvider } from 'react-router'

import type { BlogSession, SessionUser } from '@/server/session'

import { requestContext, sessionContext } from '@/server/session'

import { regularSession } from './session'

// Stand-in for the `RouterContextProvider` that `sessionMiddleware` populates
// in production. Direct loader/action unit tests that bypass the router get
// a context that already has the session + request facts pre-loaded so the
// route handler's `context.get(sessionContext)` keeps working.
export interface MakeContextOptions {
  request?: Request
  session?: BlogSession
  user?: SessionUser
  admin?: boolean
  clientAddress?: string
}

export function makeRouteContext({
  request = new Request('http://localhost/'),
  session = regularSession(),
  user,
  admin,
  clientAddress = '127.0.0.1',
}: MakeContextOptions = {}): RouterContextProvider {
  const context = new RouterContextProvider()
  const resolvedUser = user ?? (session?.data?.user as SessionUser | undefined)
  const resolvedAdmin = admin ?? Boolean(resolvedUser?.admin)
  context.set(sessionContext, {
    session,
    user: resolvedUser,
    admin: resolvedAdmin,
  })
  context.set(requestContext, {
    clientAddress,
    url: new URL(request.url),
  })
  return context
}

// Convenience to match the typical `loader({ request, context, params })`
// signature without callers having to construct the args object themselves.
export function makeLoaderArgs(options: MakeContextOptions & { params?: Record<string, string | undefined> } = {}) {
  const request = options.request ?? new Request('http://localhost/')
  const context = makeRouteContext({ ...options, request })
  return { request, context, params: options.params ?? {} } as never
}

// Mirror React Router's behaviour of running the route module's `middleware`
// chain before invoking the loader/action. Used by tests that exercise admin
// routes end-to-end: those routes export `middleware = [adminMiddleware]` and
// a unit test that bypassed the chain would never see the 403 it produces.
export async function runRouteWithMiddleware<TArgs extends { request: Request; context: RouterContextProvider }>(
  middleware: ReadonlyArray<MiddlewareFunction<Response>>,
  args: TArgs,
  handler: (args: TArgs) => Promise<Response> | Response,
): Promise<Response> {
  let index = 0
  const dispatch = async (): Promise<Response> => {
    const fn = middleware[index]
    if (!fn) {
      return handler(args)
    }
    index += 1
    const result = await fn(args as never, dispatch)
    if (result === undefined) {
      throw new Error('Middleware did not return a Response or call next()')
    }
    return result
  }
  return dispatch()
}
