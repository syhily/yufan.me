import type { AppRoute, AppRouter } from '@ts-rest/core'
import type { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'

import { isAppRoute } from '@ts-rest/core'
import { HTTPException } from 'hono/http-exception'
import { ZodError, type ZodType } from 'zod'

import type { Env } from './context'

interface HandlerContext {
  request: Request
  session: Env['Variables']['session']
  viewer: Env['Variables']['viewer'] | null
  clientAddress: string
}

// Extract the output type from a Zod schema at the type level.
// Compatible with Zod v4 (uses ZodType<..., ..., O> instead of _output).
type SchemaOutput<T> = T extends ZodType<any, any, infer O> ? O : undefined

type HandlerArgs<R extends AppRoute> = {
  query: SchemaOutput<R['query']>
  body: 'body' extends keyof R ? SchemaOutput<R['body']> : undefined
  params: SchemaOutput<R['pathParams']>
  headers: SchemaOutput<R['headers']>
}

type HandlerReturn<R extends AppRoute> = {
  [K in keyof R['responses']]: { status: K; body: SchemaOutput<R['responses'][K]> }
}[keyof R['responses']]

export type ContractImpl<R extends AppRouter> = {
  [K in keyof R]: R[K] extends AppRoute
    ? (args: HandlerArgs<R[K]>, ctx: HandlerContext) => Promise<HandlerReturn<R[K]>>
    : R[K] extends AppRouter
      ? ContractImpl<R[K]>
      : never
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
    const node = contract[key]
    const handler = (impl as Record<string, unknown>)[key]

    if (isAppRoute(node)) {
      mountRoute(app, node, handler as Function, options)
    } else {
      mountContract(app, node as AppRouter, handler as ContractImpl<AppRouter>, options)
    }
  }
}

function mountRoute(app: Hono<Env>, route: AppRoute, handler: Function, options: MountOptions) {
  const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete' | 'put'
  const path = normalizePath(route.path)

  const middlewares = options.middleware ?? []

  ;(app as any)[method](path, ...middlewares, async (c: any) => {
    const params = route.pathParams ? validate(route.pathParams, c.req.param()) : undefined
    const query = route.query ? validate(route.query, parseQuery(c.req.query())) : undefined
    const body =
      'body' in route && (route as any).body
        ? validate((route as any).body, await readBody(c.req.raw, route))
        : undefined
    const headers =
      route.headers && typeof (route.headers as any).parse === 'function'
        ? validate(route.headers, headerObj(c.req.raw.headers))
        : undefined

    const ctx: HandlerContext = {
      request: c.req.raw,
      session: c.var.session,
      viewer: c.var.viewer ?? null,
      clientAddress: c.var.clientAddress,
    }

    const result = await handler({ params, query, body, headers }, ctx)
    if (result.headers && typeof result.headers === 'object') {
      for (const [k, v] of Object.entries(result.headers)) {
        if (v !== undefined) c.header(k, String(v))
      }
    }
    return c.json(result.body, result.status as any)
  })
}

function validate(schema: unknown, input: unknown) {
  try {
    if (typeof (schema as any).parse !== 'function') {
      return input
    }
    return (schema as any).parse(input)
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HTTPException(400, {
        message: '输入数据无效',
        cause: err.issues.map((i) => ({ message: i.message, path: i.path.map(String) })),
      })
    }
    throw err
  }
}

async function readBody(req: Request, route: AppRoute): Promise<unknown> {
  if (route.method === 'GET' || route.method === 'DELETE') return undefined
  const ct = req.headers.get('content-type') ?? ''
  if (ct.startsWith('application/json')) return req.json()
  if (ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data')) {
    const fd = await req.formData()
    return Object.fromEntries(fd.entries())
  }
  return undefined
}

function parseQuery(q: Record<string, string>): unknown {
  // ts-rest supports JSON-encoded query for nested objects, but we keep flat for simplicity
  return q
}

function headerObj(h: Headers): Record<string, string> {
  const obj: Record<string, string> = {}
  h.forEach((v, k) => (obj[k] = v))
  return obj
}

function normalizePath(p: string): string {
  // ts-rest paths use ":param", Hono uses ":param" too — pass through
  return p.startsWith('/') ? p : `/${p}`
}
