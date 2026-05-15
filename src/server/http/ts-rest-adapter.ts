import type { AppRoute, AppRouter, ContractNoBodyType } from '@ts-rest/core'
import type { Context, Hono, MiddlewareHandler } from 'hono'
import type { output, ZodType } from 'zod'

import { isAppRoute } from '@ts-rest/core'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import type { Env } from './context'

interface HandlerContext {
  request: Request
  session: Env['Variables']['session']
  viewer: Env['Variables']['viewer'] | null
  clientAddress: string
}

// Extract the output type from a Zod schema at the type level.
// Uses Zod v4's public `output<T>` utility.
// Returns `unknown` for non-Zod types (e.g. c.noBody()) so union
// bodies do not collapse to `undefined | output<>`.
type SchemaOutput<T> = T extends ZodType ? output<T> : unknown

type HandlerArgs<R extends AppRoute> = {
  query: SchemaOutput<R['query']>
  body: R extends { body: infer B } ? (B extends ContractNoBodyType ? undefined : SchemaOutput<B>) : undefined
  params: SchemaOutput<R['pathParams']>
  headers: SchemaOutput<R['headers']>
}

type NumericStatus<S> = S extends `${infer N extends number}` ? N : S extends number ? S : never

type ResponseEntry<R extends AppRoute, K extends string | number> = K extends keyof R['responses']
  ? { status: NumericStatus<K>; body: SchemaOutput<R['responses'][K]> }
  : never

type HandlerReturn<R extends AppRoute> = {
  [K in keyof R['responses'] & (string | number)]: ResponseEntry<R, K>
}[keyof R['responses'] & (string | number)]

export type ContractImpl<R extends AppRouter> = {
  [K in keyof R as K extends `_${string}` ? never : K]: R[K] extends AppRoute
    ? (args: HandlerArgs<R[K]>, ctx: HandlerContext) => Promise<HandlerReturn<R[K]>>
    : R[K] extends AppRouter
      ? ContractImpl<R[K]>
      : never
}

export interface MountOptions {
  middleware?: MiddlewareHandler<Env>[]
}

type AllowedMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'

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
      if (typeof handler !== 'function') {
        throw new Error(`Missing implementation for contract key: ${key}`)
      }
      mountRoute(app, node, handler as HandlerFn, options)
    } else {
      mountContract(app, node as AppRouter, handler as ContractImpl<AppRouter>, options)
    }
  }
}

type HandlerFn = (args: unknown, ctx: HandlerContext) => Promise<unknown>

/**
 * Hono's type definitions do not support dynamic method dispatch
 * (e.g. `app[method](path, ...handlers)`).  This helper isolates the
 * unavoidable `unknown` cast to a single three-line function so the
 * rest of the adapter stays fully typed.
 */
function registerHonoRoute(app: Hono<Env>, method: AllowedMethod, path: string, handlers: unknown[]): void {
  const hono = app as unknown as Record<string, (path: string, ...handlers: unknown[]) => void>
  hono[method.toLowerCase()](path, ...handlers)
}

function mountRoute(app: Hono<Env>, route: AppRoute, handler: HandlerFn, options: MountOptions) {
  const path = normalizePath(route.path)
  const middlewares = options.middleware ?? []

  const routeHandler = async (c: Context<Env>) => {
    const params = route.pathParams ? validate(route.pathParams, c.req.param()) : undefined
    const query = route.query ? validate(route.query, parseQuery(c.req.query())) : undefined
    const body = 'body' in route && route.body ? validate(route.body, await readBody(c.req.raw, route)) : undefined
    const headers =
      route.headers && hasParseMethod(route.headers) ? validate(route.headers, headerObj(c.req.raw.headers)) : undefined

    const ctx: HandlerContext = {
      request: c.req.raw,
      session: c.var.session,
      viewer: c.var.viewer ?? null,
      clientAddress: c.var.clientAddress,
    }

    const result = (await handler({ params, query, body, headers }, ctx)) as {
      status: number
      body: unknown
      headers?: Record<string, string | string[] | undefined>
    }

    if (result.headers && typeof result.headers === 'object') {
      for (const [k, v] of Object.entries(result.headers)) {
        if (v === undefined) {
          continue
        }
        if (Array.isArray(v)) {
          for (const item of v) {
            c.header(k, String(item), { append: true })
          }
        } else {
          c.header(k, String(v))
        }
      }
    }
    return c.json(result.body, result.status as Parameters<typeof c.json>[1])
  }

  registerHonoRoute(app, route.method as AllowedMethod, path, [...middlewares, routeHandler])
}

function hasParseMethod(value: unknown): value is { parse: (input: unknown) => unknown } {
  return typeof (value as { parse?: unknown }).parse === 'function'
}

function validate(schema: unknown, input: unknown) {
  try {
    if (!hasParseMethod(schema)) {
      return input
    }
    return schema.parse(input)
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
  if (route.method === 'GET' || route.method === 'DELETE') {
    return undefined
  }
  const ct = req.headers.get('content-type') ?? ''
  if (ct.startsWith('application/json')) {
    return req.json()
  }
  if (ct.startsWith('multipart/form-data')) {
    return req.formData()
  }
  if (ct.startsWith('application/x-www-form-urlencoded')) {
    const fd = await req.formData()
    return Object.fromEntries(fd.entries())
  }
  throw new HTTPException(415, { message: '不支持的 Content-Type' })
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
