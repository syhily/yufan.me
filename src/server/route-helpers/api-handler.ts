import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import type { ZodError, ZodType } from 'zod'

import type { BlogSession } from '@/server/session'

import { requireUserRole, type Role, type ViewerContext } from '@/server/auth/rbac'
import { getLogger } from '@/server/logger'
import { ActionFailure, DomainError, domainStatus } from '@/server/route-helpers/errors'
import { getRouteRequestContext } from '@/server/session'

// `ActionFailure` and `domainStatus` live in `routes/_shared/errors.ts`
// alongside `DomainError`, so callers have a single import for the whole
// error vocabulary. They're re-exported here too because the historical path
// `@/server/route-helpers/api-handler` is what most resource-route modules
// import from.
export { ActionFailure, domainStatus } from '@/server/route-helpers/errors'

const log = getLogger('api.handler')

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

/**
 * Reject the request before reading the body if `Content-Length`
 * declares more than `limit` bytes. Endpoints that accept large
 * editor payloads (PortableText bodies) wire this in front of
 * `readJsonInput` so a runaway client can't OOM the SSR process.
 *
 * Returns 413 Payload Too Large per RFC 9110 §15.5.14. The check is
 * advisory — `Content-Length` can be missing on chunked transfers
 * — but the editor's `submitApiAction` always sets it, so the guard
 * holds in the cases that matter.
 */
export function assertContentLengthUnder(request: Request, limit: number): void {
  const header = request.headers.get('content-length')
  if (header === null) {
    return
  }
  const declared = Number.parseInt(header, 10)
  if (Number.isFinite(declared) && declared > limit) {
    throw new ActionFailure(413, `请求体超过 ${Math.round(limit / 1024)}KB 限制`)
  }
}

export async function parseInput<T>(schema: ZodType<T>, input: unknown): Promise<T> {
  const result = await schema.safeParseAsync(input)
  if (result.success) {
    return result.data
  }
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
    if (typeof value !== 'string') {
      continue
    }
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
// Resource Route perimeter (`runApi`)
// ---------------------------------------------------------------------------

// Per-request context every resource-route handler can lazily destructure.
// Built once by `runApi` so handlers don't each re-derive session / IP / URL.
//
// `session` is intentionally exposed but should ONLY be used for cookie
// operations (CSRF rotation, `commitSession`). To read the authenticated
// user, prefer `viewer` from `defineGuardedApiAction`. For opt-in admin
// checks in unguarded endpoints (e.g. rate-limit bypass for logged-in
// admins on `comment.replyComment`), `userSession(ctx.session)?.role`
// is acceptable but should carry a comment explaining why a guarded
// action wasn't used.
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
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const keys = Object.keys(value)
  return keys.includes('data') && keys.every((k) => k === 'data' || k === 'headers')
}

// Always invoked from a real React Router loader/action invocation, so the
// `RouterContext` is already populated by `src/server/middleware/session.ts`.
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
    if (result instanceof Response) {
      return result
    }
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
    log.error('unexpected error', { requestId, error })
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
//
// Defaults are picked from the HTTP method when the caller doesn't override.
type InputSource = 'json' | 'search' | 'form' | 'auto'

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

interface ApiActionConfig<I, O> {
  method: HttpMethod | HttpMethod[]
  /**
   * Optional Zod schema. Pass `undefined` for endpoints without an input
   * payload (e.g. read-only listings whose only "input" is the session
   * cookie itself).
   */
  input?: ZodType<I>
  inputSource?: InputSource
  /**
   * Reject the request with 413 if the declared `Content-Length`
   * exceeds this many bytes. Use on endpoints that accept large
   * editor payloads (PortableText bodies, image metadata) to put a
   * cheap upper bound on the request before the body is even read.
   */
  maxBodyBytes?: number
  run: (params: { ctx: ApiContext; payload: I }) => Promise<ApiResult<O>> | ApiResult<O>
}

interface GuardedApiActionConfig<I, O> extends Omit<ApiActionConfig<I, O>, 'run'> {
  /**
   * Minimum role required to invoke this action. The handler's
   * `viewer` is non-nullable as a direct consequence — the gate
   * enforces that `user` + `user.role` exist on every call.
   */
  requireRole: Role
  run: (params: { ctx: ApiContext; payload: I; viewer: ViewerContext }) => Promise<ApiResult<O>> | ApiResult<O>
}

function sourceFor(request: Request, override: InputSource | undefined): InputSource {
  return override ?? (request.method === 'GET' ? 'search' : 'json')
}

function methodsOf(method: HttpMethod | HttpMethod[]): HttpMethod[] {
  return Array.isArray(method) ? method : [method]
}

/**
 * Resource-route action without role gating. Use this for public
 * endpoints (anonymous comment replies, public RSS feeds, ...) and
 * for endpoints that need opt-in admin detection (e.g. rate-limit
 * bypass for logged-in admins on `comment.replyComment`).
 *
 * If you need «must be logged in as at least role X», use
 * {@link defineGuardedApiAction} instead — its `viewer` parameter is
 * non-nullable and the gate is enforced before `run` is called.
 */
export function defineApiAction<I, O>(config: ApiActionConfig<I, O>) {
  const methods = methodsOf(config.method)
  return (args: Pick<LoaderFunctionArgs, 'request' | 'context'>) =>
    runApi(args, async (ctx) => {
      assertMethod(ctx.request, ...methods)
      if (config.maxBodyBytes !== undefined) {
        assertContentLengthUnder(ctx.request, config.maxBodyBytes)
      }
      const payload = config.input
        ? await readInputFrom(ctx, sourceFor(ctx.request, config.inputSource), config.input)
        : (undefined as I)
      return config.run({ ctx, payload })
    })
}

/**
 * Resource-route action gated on a minimum role. The handler receives
 * a non-nullable {@link ViewerContext} so callers don't need to
 * narrow `session.get('user')` themselves (and don't need non-null
 * assertions on `viewer.userId` / `viewer.role`).
 *
 * For unguarded endpoints use {@link defineApiAction}.
 */
export function defineGuardedApiAction<I, O>(config: GuardedApiActionConfig<I, O>) {
  const methods = methodsOf(config.method)
  return (args: Pick<LoaderFunctionArgs, 'request' | 'context'>) =>
    runApi(args, async (ctx) => {
      assertMethod(ctx.request, ...methods)
      const user = ctx.session.get('user')
      requireUserRole(user, config.requireRole)
      // `user` is now narrowed to `SessionUser` (non-null role) by the
      // assertion above — no `!` needed.
      const viewer: ViewerContext = { userId: user.id, role: user.role }
      if (config.maxBodyBytes !== undefined) {
        assertContentLengthUnder(ctx.request, config.maxBodyBytes)
      }
      const payload = config.input
        ? await readInputFrom(ctx, sourceFor(ctx.request, config.inputSource), config.input)
        : (undefined as I)
      return config.run({ ctx, payload, viewer })
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
