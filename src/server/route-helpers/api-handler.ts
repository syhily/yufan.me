import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import type { ZodError, ZodType } from 'zod'

import type { BlogSession } from '@/server/session'

import { ActionFailure, DomainError, domainStatus, ErrorMessages } from '@/server/route-helpers/errors'
import { getRouteRequestContext, isAdmin } from '@/server/session'

// `ActionFailure` and `domainStatus` live in `routes/_shared/errors.ts`
// alongside `DomainError`, so callers have a single import for the whole
// error vocabulary. They're re-exported here too because the historical path
// `@/server/route-helpers/api-handler` is what most resource-route modules
// import from.
export { ActionFailure, domainStatus } from '@/server/route-helpers/errors'

// ---------------------------------------------------------------------------
// Response envelope helpers
// ---------------------------------------------------------------------------

export type ActionData = Record<string, unknown> | string | number | boolean | null | undefined

export function ok(data?: ActionData, headers?: HeadersInit): Response {
  return jsonResponse({ data }, { headers })
}

export function fail(
  status: number,
  message: string,
  issues?: { message: string; path?: string[] }[],
  headers?: HeadersInit,
): Response {
  return jsonResponse({ error: { message, issues } }, { status, headers })
}

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return new Response(JSON.stringify(payload, jsonReplacer), {
    ...init,
    headers,
  })
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ActionFailure(400, 'Invalid JSON request body')
  }
}

export async function parseInput<T>(schema: ZodType<T>, input: unknown): Promise<T> {
  const result = await schema.safeParseAsync(input)
  if (result.success) return result.data
  throw zodFailure(result.error)
}

// Parse + validate the request JSON body against a Zod schema. Throws
// `ActionFailure(400)` on either parse or validation failure (caught by
// `runApi`).
export async function readJsonInput<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const raw = await parseJson(request)
  return parseInput(schema, raw)
}

// Parse + validate URL search params. Repeated keys collapse to the last
// value (form-encoded convention). Returns the validated, typed payload.
export async function readSearchInput<T>(url: URL, schema: ZodType<T>): Promise<T> {
  const obj: Record<string, string> = {}
  for (const [key, value] of url.searchParams.entries()) {
    obj[key] = value
  }
  return parseInput(schema, obj)
}

// Parse + validate `multipart/form-data` or
// `application/x-www-form-urlencoded` request bodies. Used by Resource Route
// actions that are reached through `<fetcher.Form method="post">` instead of
// the JSON channel. File entries are dropped (the API doesn't accept blobs);
// duplicate keys collapse to the last value, matching `readSearchInput`.
export async function readFormDataInput<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new ActionFailure(400, 'Invalid form-encoded request body')
  }
  const obj: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue
    obj[key] = value
  }
  return parseInput(schema, obj)
}

// Reject any HTTP method other than the listed ones. Use at the top of an
// `action` that intentionally only accepts e.g. PATCH or DELETE. (Loaders
// don't need this — React Router only routes GET/HEAD to them.)
export function assertMethod(request: Request, ...allowed: string[]): void {
  if (!allowed.includes(request.method)) {
    throw new ActionFailure(405, `Method ${request.method} not allowed`)
  }
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export function requireAdminSession(session: BlogSession): BlogSession {
  if (!isAdmin(session)) {
    // Logged-in non-admins are *forbidden*, not unauthenticated. Returning
    // 401 here causes most HTTP clients to retry with credentials, so use
    // 403 to communicate "you are who you say you are, but the door is shut".
    throw new ActionFailure(403, ErrorMessages.NOT_ADMIN)
  }
  return session
}

// ---------------------------------------------------------------------------
// Resource Route perimeter (`runApi`)
// ---------------------------------------------------------------------------

// Per-request context every resource-route handler can lazily destructure.
// Built once by `runApi` so handlers don't each re-derive session / IP / URL.
export interface ApiContext {
  request: Request
  url: URL
  session: BlogSession
  clientAddress: string
}

export type ApiHandler<O> = (ctx: ApiContext) => Promise<ApiResult<O>> | ApiResult<O>
export type ApiResult<O> = O | ApiEnvelope<O> | Response

export interface ApiEnvelope<O> {
  data: O
  headers?: HeadersInit
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== 'object' || value === null) return false
  const keys = Object.keys(value)
  return keys.includes('data') && keys.every((k) => k === 'data' || k === 'headers')
}

// Always invoked from a real React Router loader/action invocation, so the
// `RouterContext` is already populated by `src/middleware/session.server.ts`.
// Tests construct the same shape via `tests/_helpers/context.ts`
// (`makeLoaderArgs` / `makeRouteContext`).
type RunApiArgs = Pick<LoaderFunctionArgs, 'request' | 'context'> | Pick<ActionFunctionArgs, 'request' | 'context'>

// Single try/catch perimeter shared by every Resource Route loader/action.
// Performs:
// 1. Session + client address resolution (from middleware context).
// 2. Handler invocation.
// 3. Envelope unwrap → JSON `{ data }` response (preserving headers).
// 4. `Response` pass-through (for handlers that already crafted their own).
// 5. Translation of `ActionFailure` / `DomainError` / unknown errors into the
//    `{ error: { message, issues? } }` JSON contract the client expects.
export async function runApi<O>(args: RunApiArgs, handler: ApiHandler<O>): Promise<Response> {
  try {
    const resolved = getRouteRequestContext(args)
    const ctx: ApiContext = {
      request: args.request,
      url: resolved.url,
      session: resolved.session,
      clientAddress: resolved.clientAddress,
    }
    const result = await handler(ctx)
    if (result instanceof Response) return result
    if (isEnvelope(result)) {
      return ok(result.data as never, result.headers)
    }
    return ok(result as never)
  } catch (error) {
    if (error instanceof ActionFailure) {
      return fail(error.status, error.message, error.issues, error.headers)
    }
    if (error instanceof DomainError) {
      return fail(domainStatus(error), error.message)
    }
    const requestId = crypto.randomUUID()
    console.error('[api] unexpected error', { requestId, error })
    return jsonResponse(
      { error: { message: '服务器内部错误' } },
      { status: 500, headers: { 'X-Request-Id': requestId } },
    )
  }
}

// ---------------------------------------------------------------------------
// Resource Route declarative helper (`defineApiAction`)
// ---------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

// Where to read the input from. JSON body for write methods; URL search
// params for GET (where bodies aren't conventional); form-encoded body for
// React Router `<fetcher.Form method="post">` submissions that go through a
// Resource Route action. `'auto'` inspects the request's `Content-Type` and
// dispatches to JSON or form parsing accordingly — useful for endpoints that
// have to handle both shapes during a migration.
//
// Defaults are picked from the HTTP method when the caller doesn't override.
type InputSource = 'json' | 'search' | 'form' | 'auto'

interface DefineApiActionConfig<I, O> {
  method: HttpMethod | HttpMethod[]
  // Optional Zod schema. Pass `undefined` for endpoints without an input
  // payload (e.g. `comment.getFilterOptions`).
  input?: ZodType<I>
  inputSource?: InputSource
  requireAdmin?: boolean
  run: (params: {
    ctx: ApiContext
    payload: I
    /**
     * Lazy admin check. Returns `true` for endpoints declared with
     * `requireAdmin: true` (the gate has already passed). For everything
     * else we defer to `isAdmin(session)` only when the handler actually
     * asks — most non-admin endpoints (likes, avatars, replies) never read
     * this and shouldn't pay for an extra session lookup per request.
     */
    isAdmin: () => boolean
  }) => Promise<ApiResult<O>> | ApiResult<O>
}

// Resolve the request payload to the validated input shape, choosing the
// channel based on the declared (or inferred) `InputSource`. Centralised so
// the wire-format vocabulary stays in one place.
async function readInputFrom<T>(ctx: ApiContext, source: InputSource, schema: ZodType<T>): Promise<T> {
  if (source === 'auto') {
    const contentType = ctx.request.headers.get('content-type') ?? ''
    if (contentType.startsWith('application/json')) {
      return readJsonInput(ctx.request, schema)
    }
    return readFormDataInput(ctx.request, schema)
  }
  switch (source) {
    case 'search':
      return readSearchInput(ctx.url, schema)
    case 'form':
      return readFormDataInput(ctx.request, schema)
    case 'json':
      return readJsonInput(ctx.request, schema)
  }
}

// Shrinks the typical 10-line resource-route action down to a config object.
// Equivalent to writing `runApi(args, ...)` by hand but factors out method
// assertion, input parsing, admin gating, and lets the handler focus on the
// business call.
export function defineApiAction<I, O>(config: DefineApiActionConfig<I, O>) {
  const methods = Array.isArray(config.method) ? config.method : [config.method]
  const sourceFor = (request: Request): InputSource =>
    config.inputSource ?? (request.method === 'GET' ? 'search' : 'json')

  return (args: Pick<LoaderFunctionArgs, 'request' | 'context'>) =>
    runApi(args, async (ctx) => {
      assertMethod(ctx.request, ...methods)
      // `requireAdminSession` already guarantees admin === true on success,
      // so admin endpoints skip the redundant `isAdmin(session)` re-read.
      if (config.requireAdmin) requireAdminSession(ctx.session)
      const isAdminLazy = config.requireAdmin ? () => true : () => isAdmin(ctx.session)
      const payload = config.input ? await readInputFrom(ctx, sourceFor(ctx.request), config.input) : (undefined as I)
      return config.run({ ctx, payload, isAdmin: isAdminLazy })
    })
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function zodFailure(error: ZodError): ActionFailure {
  return new ActionFailure(
    400,
    '输入数据无效',
    error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.map(String),
    })),
  )
}
