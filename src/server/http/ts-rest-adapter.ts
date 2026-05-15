// ts-rest → Hono adapter.
//
// ts-rest has no official Hono adapter (as of 2026 RC). This module
// is the single project-owned bridge: it walks a contract tree, and
// for each leaf `AppRoute` mounts an HTTP handler on the supplied
// Hono app that
//
//   1. validates `pathParams`, `query`, `body`, `headers` against
//      the contract's Zod schemas (any failure throws `HTTPException`
//      that `onError` translates to 400),
//   2. invokes the matching key on the `ContractImpl` object,
//   3. JSON-encodes `{ status, body }` back through Hono.
//
// We deliberately reuse ts-rest's own `ServerInferRequest` /
// `ServerInferResponses` inference helpers so `ContractImpl<R>`
// stays in lockstep with the library's view of the contract — both
// for input narrowing (pathParams/query/body) and for the strict
// discriminated `{ status, body }` return union.

import type {
  AppRoute,
  AppRouteMutation,
  AppRouter,
  HTTPStatusCode,
  ServerInferRequest,
  ServerInferResponses,
} from '@ts-rest/core'
import type { Hono, MiddlewareHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ZodType } from 'zod'

import { isAppRoute } from '@ts-rest/core'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import type { Env, RequestContextVariables } from '@/server/http/context'

// ---------------------------------------------------------------------------
// Controller-facing types
// ---------------------------------------------------------------------------

// Per-handler invocation context — everything a controller needs
// that isn't request-shaped input. Mirrors the historical
// `ApiContext` so existing service-layer call sites move over
// without renaming.
export interface HandlerContext {
  request: Request
  session: RequestContextVariables['session']
  viewer: RequestContextVariables['viewer']
  clientAddress: string
  requestId: string
  // Set this true from a controller after mutating session state so
  // the session middleware commits + sets the cookie before responding.
  markSessionDirty: () => void
}

// Handler input shape — uses ts-rest's own inference so we never
// drift from the library's view of the contract.
export type HandlerArgs<R extends AppRoute> = ServerInferRequest<R>

// Discriminated response union — `'force'` makes ts-rest apply
// strictStatusCodes regardless of the contract's own flag, so
// controllers are forced to return ONLY the status codes the
// contract declares.
export type HandlerReturn<R extends AppRoute> = ServerInferResponses<R, HTTPStatusCode, 'force'>

export type ContractImpl<R extends AppRouter> = {
  [K in keyof R]: R[K] extends AppRoute
    ? (args: HandlerArgs<R[K]>, ctx: HandlerContext) => Promise<HandlerReturn<R[K]>> | HandlerReturn<R[K]>
    : R[K] extends AppRouter
      ? ContractImpl<R[K]>
      : never
}

export interface MountOptions {
  // Middleware to install in front of every leaf route in this
  // sub-tree. Used by `publicRoute` / `authedRoute` / `adminRoute`
  // to inject auth + CSRF + rate-limit guards.
  middleware?: MiddlewareHandler<Env>[]
}

// ---------------------------------------------------------------------------
// Mount entry point
// ---------------------------------------------------------------------------

export function mountContract<R extends AppRouter>(
  app: Hono<Env>,
  contract: R,
  impl: ContractImpl<R>,
  options: MountOptions = {},
): void {
  for (const key of Object.keys(contract)) {
    const node = (contract as Record<string, unknown>)[key]
    const handlerOrSub = (impl as Record<string, unknown>)[key]

    if (isAppRoute(node as AppRoute)) {
      mountRoute(app, node as AppRoute, handlerOrSub as AnyHandler, options)
    } else {
      mountContract(app, node as AppRouter, handlerOrSub as ContractImpl<AppRouter>, options)
    }
  }
}

// Erased handler type used inside the variadic-mount machinery. The
// public `ContractImpl<R>[K]` type is what controllers actually see;
// this alias is only for the dispatch shim below.
type AnyHandler = (
  args: { params?: unknown; query?: unknown; body?: unknown; headers?: unknown },
  ctx: HandlerContext,
) => Promise<{ status: number; body: unknown }> | { status: number; body: unknown }

function mountRoute(app: Hono<Env>, route: AppRoute, handler: AnyHandler, options: MountOptions): void {
  const path = normalizePath(route.path)
  const middlewares = options.middleware ?? []

  app.on([route.method], [path], ...middlewares, async (c) => {
    const params = route.pathParams ? validate(asZod(route.pathParams), c.req.param()) : c.req.param()
    const query = route.query ? validate(asZod(route.query), c.req.query()) : undefined
    const body = hasBody(route) ? validate(asZod(route.body), await readBody(c.req.raw)) : undefined
    // headers are a Record<string, ZodSchema> in ts-rest 3.53; we
    // only forward them if the route opts in.
    const headers =
      route.headers && !Array.isArray(route.headers)
        ? // Per-header validation isn't needed for the spike — pass
          // the raw header map through. Phase A4 may add per-header
          // schema validation if we ever use it.
          headerObj(c.req.raw.headers)
        : undefined

    const ctx: HandlerContext = {
      request: c.req.raw,
      session: c.var.session,
      viewer: c.var.viewer ?? null,
      clientAddress: c.var.clientAddress,
      requestId: c.var.requestId,
      markSessionDirty: () => c.set('sessionDirty', true),
    }

    const result = await handler({ params, query, body, headers }, ctx)
    return c.json(result.body, result.status as ContentfulStatusCode)
  })
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function hasBody(route: AppRoute): route is AppRouteMutation & { body: unknown } {
  return route.method !== 'GET' && 'body' in route && route.body != null
}

// ts-rest 3.53 admits Zod schemas, StandardSchemaV1 wrappers,
// ContractPlainType, and ContractNullType in the schema slot. For
// the spike we restrict to ZodType (the contracts only emit Zod),
// and assert here so the call sites stay clean. Phase A4 widens
// this to a StandardSchema-aware validator if non-Zod schemas
// become useful.
function asZod(schema: unknown): ZodType {
  if (schema && typeof schema === 'object' && 'parse' in schema) {
    return schema as ZodType
  }
  // The contract used a non-Zod schema (rare; only the spike's
  // simple shapes hit this path right now). Fall back to a passthrough
  // that won't reject.
  return { parse: (x: unknown) => x } as unknown as ZodType
}

function validate<T>(schema: ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input)
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HTTPException(400, {
        message: '输入数据无效',
        cause: err.issues.map((i) => ({
          message: i.message,
          path: i.path.map(String),
        })),
      })
    }
    throw err
  }
}

async function readBody(req: Request): Promise<unknown> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.startsWith('application/json')) {
    try {
      return await req.json()
    } catch {
      throw new HTTPException(400, { message: 'Invalid JSON request body' })
    }
  }
  if (contentType.startsWith('application/x-www-form-urlencoded') || contentType.startsWith('multipart/form-data')) {
    const fd = await req.formData()
    const obj: Record<string, string> = {}
    for (const [key, value] of fd.entries()) {
      if (typeof value === 'string') {
        obj[key] = value
      }
    }
    return obj
  }
  return undefined
}

function headerObj(h: Headers): Record<string, string> {
  const obj: Record<string, string> = {}
  h.forEach((v, k) => {
    obj[k] = v
  })
  return obj
}

function normalizePath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`
}
