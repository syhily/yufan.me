import type { LoaderFunctionArgs, RouterContextProvider } from 'react-router'

import { createContext } from 'react-router'

import type { SessionContext } from '@/server/auth/primitives'
import type { Role } from '@/shared/roles'

export interface RequestContextValue {
  clientAddress: string
  url: URL
}

export interface RouteRequestContext extends SessionContext, RequestContextValue {}

export const sessionContext = createContext<SessionContext>()
export const requestContext = createContext<RequestContextValue>()

type AppLoadContext = {
  session: SessionContext['session']
  user: SessionContext['user']
  role: Role | null
  clientAddress: string
  url: URL
}

/** Try to read session from either RouterContextProvider or plain AppLoadContext. */
export function tryGetSessionContext(context: unknown): SessionContext | undefined {
  if (!context) {
    return undefined
  }
  // RouterContextProvider path (old RR middleware / test helpers)
  if (typeof (context as RouterContextProvider).get === 'function') {
    try {
      return (context as RouterContextProvider).get(sessionContext)
    } catch {
      return undefined
    }
  }
  // Plain AppLoadContext path (Hono getLoadContext bridge)
  const ctx = context as AppLoadContext
  if (!ctx.session) {
    return undefined
  }
  return { session: ctx.session, user: ctx.user, role: ctx.role }
}

/** Try to read request context from either RouterContextProvider or plain AppLoadContext. */
export function tryGetRequestContext(context: unknown): RequestContextValue | undefined {
  if (!context) {
    return undefined
  }
  if (typeof (context as RouterContextProvider).get === 'function') {
    try {
      return (context as RouterContextProvider).get(requestContext)
    } catch {
      return undefined
    }
  }
  const ctx = context as AppLoadContext
  return { clientAddress: ctx.clientAddress, url: ctx.url }
}

type AnyRouteArgs = {
  request: Request
  context: LoaderFunctionArgs['context']
}

export function getRouteRequestContext(args: AnyRouteArgs): RouteRequestContext {
  const context = args.context as unknown
  // RouterContextProvider path
  if (typeof (context as RouterContextProvider).get === 'function') {
    const c = context as RouterContextProvider
    const session = c.get(sessionContext)
    const requestData = c.get(requestContext)
    return {
      session: session.session,
      user: session.user,
      role: session.role,
      clientAddress: requestData.clientAddress,
      url: requestData.url,
    }
  }
  // Plain AppLoadContext path
  const ctx = context as AppLoadContext
  return {
    session: ctx.session,
    user: ctx.user,
    role: ctx.role,
    clientAddress: ctx.clientAddress,
    url: ctx.url,
  }
}
