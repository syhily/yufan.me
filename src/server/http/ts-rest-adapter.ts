import type { AppRoute, AppRouter } from '@ts-rest/core'
import type { Hono, MiddlewareHandler } from 'hono'
import type { z } from 'zod'

import { isAppRoute, isAppRouteNoBody } from '@ts-rest/core'
import { HTTPException } from 'hono/http-exception'

import type { Env } from './context'

type ZodSchema = z.ZodType<unknown>

export interface HandlerContext {
  request: Request
  session: Env['Variables']['session']
  viewer: Env['Variables']['viewer']
  clientAddress: string
}

/** Narrow `viewer` to non-null. Guards guarantee it before the controller runs. */
export function requireViewer(ctx: HandlerContext): NonNullable<HandlerContext['viewer']> {
  if (!ctx.viewer) {
    throw new Error('viewer missing — guard middleware must run first')
  }
  return ctx.viewer
}

export type HandlerArgs = Record<string, unknown>

type HandlerReturn<_R extends AppRoute> = {
  status: number
  body: any
  headers?: Record<string, string>
}

// ContractImpl: enforces that every contract endpoint has a matching handler key.
// Nested routers are recursively checked. This catches renamed/missing handlers
// at compile time. Full parameter type inference requires upstream ts-rest/Zod v4
// improvements — use body<T>()/query<T>()/params<T>() accessors in the meantime.
type RouteHandler = (args: Record<string, unknown>, ctx: HandlerContext) => Promise<HandlerReturn<AppRoute>>

export type ContractImpl<R extends AppRouter> = {
  [K in keyof R & string]: R[K] extends AppRoute ? RouteHandler : R[K] extends AppRouter ? ContractImpl<R[K]> : never
}

export interface MountOptions {
  middleware?: MiddlewareHandler<Env>[]
}

export function mountContract<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  options: MountOptions = {},
): void {
  for (const key of Object.keys(contract)) {
    const node = contract[key as keyof R]
    const handler = (impl as Record<string, unknown>)[key as string]

    if (isAppRoute(node)) {
      mountRoute(app, node as AppRoute, handler as (...args: unknown[]) => unknown, options)
    } else {
      mountContract(app, node as AppRouter, handler as ContractImpl<AppRouter>, options)
    }
  }
}

function mountRoute(app: Hono<Env>, route: AppRoute, handler: (...args: unknown[]) => unknown, options: MountOptions) {
  const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete' | 'put'
  const path = normalizePath(route.path)
  const middlewares = options.middleware ?? []

  ;(app as any)[method](path, ...middlewares, async (c: any) => {
    const params = route.pathParams ? validate(route.pathParams as ZodSchema, c.req.param()) : undefined
    const query = route.query ? validate(route.query as ZodSchema, parseQuery(c.req.query())) : undefined
    // body only exists on mutation routes
    const body =
      'body' in route && route.body && !isAppRouteNoBody(route.body)
        ? validate(route.body as ZodSchema, await readBody(c.req.raw, route))
        : undefined
    const headers = route.headers ? validate(route.headers as ZodSchema, headerObj(c.req.raw.headers)) : undefined

    const ctx: HandlerContext = {
      request: c.req.raw,
      session: c.var.session,
      viewer: c.var.viewer ?? null,
      clientAddress: c.var.clientAddress,
    }

    const result = (await handler({ params, query, body, headers }, ctx)) as HandlerReturn<AppRoute>
    return safeJson(result.body, result.status, result.headers)
  })
}

function validate(schema: ZodSchema, input: unknown) {
  const result = schema.safeParse(input)
  if (result.success) {
    return result.data
  }
  const issues = result.error.issues.map((i) => ({ message: i.message, path: i.path.map(String) }))
  const firstPath = issues[0]?.path?.join('.') ?? ''
  throw new HTTPException(400, {
    message: firstPath ? `输入数据无效 (${firstPath})` : '输入数据无效',
    cause: issues,
  })
}

async function readBody(req: Request, route: AppRoute): Promise<unknown> {
  if (route.method === 'GET') {
    return undefined
  }
  const contentLength = Number.parseInt(req.headers.get('content-length') ?? '0', 10)
  const ct = req.headers.get('content-type') ?? ''
  if (ct.startsWith('application/json')) {
    if (contentLength > 10 * 1024 * 1024) {
      throw new HTTPException(413, { message: '请求体过大（上限 10 MB）' })
    }
    return req.json()
  }
  if (ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data')) {
    if (contentLength > 50 * 1024 * 1024) {
      throw new HTTPException(413, { message: '请求体过大（上限 50 MB）' })
    }
    const fd = await req.formData()
    return Object.fromEntries(fd.entries())
  }
  return undefined
}

function parseQuery(q: Record<string, string>): Record<string, string> {
  return q
}

function headerObj(h: Headers): Record<string, string> {
  const obj: Record<string, string> = {}
  h.forEach((v, k) => (obj[k] = v))
  return obj
}

function normalizePath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`
}

const bigintReplacer = (_: string, v: unknown) => (typeof v === 'bigint' ? Number(v) : v)

function safeJson(data: unknown, status: number, headers?: Record<string, string>): Response {
  const body = JSON.stringify(data, bigintReplacer)
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}

/** Resolve entity ID from path param (:id) or legacy body/query. */
export function resolveId(args: Record<string, unknown>): string {
  const p = args.params as { id?: string } | undefined
  if (p?.id) {
    return p.id
  }
  const b = args.body as { id?: string; userId?: string } | undefined
  if (b?.id) {
    return b.id
  }
  if (b?.userId) {
    return b.userId
  }
  const q = args.query as { id?: string; userId?: string } | undefined
  if (q?.id) {
    return q.id
  }
  if (q?.userId) {
    return q.userId
  }
  throw new HTTPException(400, { message: '缺少资源 ID (path param :id 或 body/query 中的 id/userId)' })
}

// ── Typed accessor helpers ──────────────────────────────────
// Eliminate `args.body as SomeType` anti-pattern across all controllers.

/** Extract and type-narrow the request body. */
export function body<T>(args: Record<string, unknown>): T {
  return (args.body ?? {}) as T
}

/** Extract and type-narrow the query parameters. */
export function query<T>(args: Record<string, unknown>): T {
  return (args.query ?? {}) as T
}

/** Extract and type-narrow the path parameters. */
export function params<T>(args: Record<string, unknown>): T {
  return (args.params ?? {}) as T
}

/** Safely convert a string ID to BigInt. Returns 400 on invalid input. */
export function asId(value: string): bigint {
  try {
    return BigInt(value)
  } catch {
    throw new HTTPException(400, { message: `无效的 ID 格式: ${value}` })
  }
}
