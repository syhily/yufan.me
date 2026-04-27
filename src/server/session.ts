import type { LoaderFunctionArgs, MiddlewareFunction, RouterContextProvider, Session } from 'react-router'
import type { ZodType } from 'zod'

import { createContext, createCookie, createSessionStorage, data, redirect } from 'react-router'

import { redisInstance } from '@/server/cache/storage'
import { hasAdmin, insertAdmin, updateLastLogin, verifyUserPassword } from '@/server/db/query/user'
import { SESSION_SECRET } from '@/server/env'
import { tryRateLimit } from '@/server/rate-limit'
import { getClientAddress } from '@/shared/request'
import { makeToken, timingSafeEqual } from '@/shared/security'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string
  name: string
  email: string
  website: string | null
  admin: boolean
}

export interface BlogSessionData {
  user?: SessionUser
}

export type BlogSession = Session<BlogSessionData, BlogSessionData>

export interface SessionContext {
  session: BlogSession
  user: SessionUser | undefined
  admin: boolean
}

export interface RequestContextValue {
  /** Best-effort caller IP, threaded through proxy headers in the middleware. */
  clientAddress: string
  /** Parsed `request.url` (so handlers don't reconstruct it per call). */
  url: URL
}

// `RouteRequestContext` flattens `SessionContext` + `RequestContextValue` for
// loaders that want everything the perimeter computed in one struct.
export interface RouteRequestContext extends SessionContext, RequestContextValue {}

// ---------------------------------------------------------------------------
// Cookie-backed session storage
// ---------------------------------------------------------------------------

const SESSION_MAX_AGE = 60 * 60 * 24 * 30

const storage = createSessionStorage<BlogSessionData>({
  cookie: {
    name: '__session',
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    secrets: [SESSION_SECRET],
  },
  async createData(data, expires) {
    const id = crypto.randomUUID()
    await writeSession(id, data, expires)
    return id
  },
  async readData(id) {
    const value = await redisInstance().get(`session:${id}`)
    if (!value) {
      return null
    }
    return JSON.parse(value) as BlogSessionData
  },
  async updateData(id, data, expires) {
    await writeSession(id, data, expires)
  },
  async deleteData(id) {
    await redisInstance().del(`session:${id}`)
  },
})

async function writeSession(id: string, data: BlogSessionData, expires: Date | undefined): Promise<void> {
  const redis = redisInstance()
  const payload = JSON.stringify(data)
  if (expires) {
    await redis.set(`session:${id}`, payload, 'PXAT', expires.getTime())
  } else {
    await redis.set(`session:${id}`, payload, 'EX', SESSION_MAX_AGE)
  }
}

export const { getSession, commitSession, destroySession } = storage

export async function getRequestSession(request: Request): Promise<BlogSession> {
  return getSession(request.headers.get('Cookie'))
}

// One-shot helper for page loaders: every detail/listing route was doing
// `getRequestSession` + `userSession` + `isAdmin` in three lines. Bundle
// those into one await so route loaders can stay focused on their data
// fetching.
export async function resolveSessionContext(request: Request): Promise<SessionContext> {
  const session = await getRequestSession(request)
  const user = userSession(session)
  return { session, user, admin: user?.admin === true }
}

// ---------------------------------------------------------------------------
// Auth primitives
// ---------------------------------------------------------------------------

export async function login({
  email,
  password,
  session,
  request,
  clientAddress,
}: {
  email: string
  password: string
  session: BlogSession
  request: Request
  clientAddress: string
}): Promise<boolean> {
  const user = await verifyUserPassword(email, password)
  if (user === null) {
    return false
  }

  session.set('user', {
    id: `${user.id}`,
    name: user.name,
    email: user.email,
    website: user.link,
    admin: user.isAdmin !== null && user.isAdmin,
  })

  await updateLastLogin(user.id, clientAddress, request.headers.get('User-Agent'))
  return true
}

export function userSession(session: BlogSession): SessionUser | undefined {
  return session.get('user')
}

export function logout(session: BlogSession): void {
  session.unset('user')
}

export function isAdmin(session: BlogSession): boolean {
  return userSession(session)?.admin === true
}

// ---------------------------------------------------------------------------
// CSRF (double-submit cookie)
// ---------------------------------------------------------------------------

// Double-submit cookie CSRF protection. Issuing a token only writes a
// signed cookie (no Redis hop, no session mutation), and validation just
// compares the cookie value with the form field. Replay protection still
// rides on the cookie's short max-age + the per-form `<input type="hidden">`
// pairing.
const CSRF_TOKEN_TTL_SECONDS = 60 * 5
const CSRF_TOKEN_LENGTH = 48

// HttpOnly is safe here: nothing in `src/assets/scripts/**` reads the
// cookie value. Loaders embed the token directly in the admin form via a
// hidden field, so the browser never needs JS access. SameSite=Lax pairs
// with the per-form hidden token to defeat both classic CSRF and
// cross-site form posts. Secure is enabled in PROD so the cookie isn't
// sent over plain HTTP (dev keeps it off so localhost still works).
const csrfCookie = createCookie('csrf-token', {
  httpOnly: true,
  maxAge: CSRF_TOKEN_TTL_SECONDS,
  path: '/',
  sameSite: 'lax',
  secure: import.meta.env.PROD,
  secrets: [SESSION_SECRET],
})

export interface IssuedCsrfToken {
  token: string
  setCookie: string
}

export async function issueCsrfToken(): Promise<IssuedCsrfToken> {
  const token = makeToken(CSRF_TOKEN_LENGTH)
  const setCookie = await csrfCookie.serialize(token)
  return { token, setCookie }
}

export async function validateRequestCsrf(request: Request, formToken: string | undefined): Promise<[boolean, string]> {
  if (formToken === undefined || formToken === '') {
    return [false, 'Missing CSRF token in form submission']
  }
  const cookieHeader = request.headers.get('Cookie')
  const cookieToken = (await csrfCookie.parse(cookieHeader)) as string | null
  if (cookieToken === null || cookieToken === '') {
    return [false, 'Missing or expired CSRF cookie']
  }
  if (!timingSafeEqual(cookieToken, formToken)) {
    return [false, 'CSRF token mismatch']
  }
  return [true, '']
}

export async function clearCsrfCookie(): Promise<string> {
  return csrfCookie.serialize('', { maxAge: 0 })
}

// ---------------------------------------------------------------------------
// React Router middleware + context plumbing
// ---------------------------------------------------------------------------

// Per-request facts are computed once by `sessionMiddleware` and exposed
// through these `RouterContext`s so loaders/actions/runApi can read them
// with `context.get(sessionContext)` instead of each re-decrypting the
// cookie and re-deriving admin/client-address. See `react-router.config.ts`
// `future.v8_middleware: true` for the opt-in.
export const sessionContext = createContext<SessionContext>()
export const requestContext = createContext<RequestContextValue>()

// Single per-request perimeter wired up on `root.tsx` (`export const
// middleware = [sessionMiddleware]`). Decrypts the session cookie, derives
// `{ session, user, admin }`, and pre-parses the request URL + client IP
// into `RouterContextProvider` so loaders/actions/`runApi` can read them.
// Saves ~50 cookie decrypts per typical page render.
export const sessionMiddleware: MiddlewareFunction<Response> = async ({ request, context }, next) => {
  const session = await resolveSessionContext(request)
  context.set(sessionContext, session)
  context.set(requestContext, {
    clientAddress: getClientAddress(request),
    url: new URL(request.url),
  })
  return next()
}

// Per-route middleware for admin-only API surfaces. Reads the
// `sessionContext` populated by `sessionMiddleware` (so it must run *after*
// it) and short-circuits the request with a JSON 403 envelope before the
// route's loader/action runs. Keeps the gate at the routing layer instead
// of being re-declared inside every `defineApiAction({ requireAdmin: true })`.
//
// Routes opt-in by exporting `middleware = [adminMiddleware]` from their
// route module.
export const adminMiddleware: MiddlewareFunction<Response> = ({ context }, next) => {
  const session = context.get(sessionContext)
  if (!session.admin) {
    // Match the legacy `requireAdminSession` JSON envelope so existing
    // clients keep parsing the same `{ error: { message } }` shape.
    return Promise.resolve(
      new Response(JSON.stringify({ error: { message: '当前用户不是管理员。' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }
  return next()
}

// `RouterContextProvider` only stores values for keys that have been written.
// Reads on missing keys throw, so we guard against tests / direct unit
// invocations of route handlers that bypass the middleware perimeter.
export function tryGetSessionContext(context: Readonly<RouterContextProvider> | undefined): SessionContext | undefined {
  if (context === undefined) {
    return undefined
  }
  try {
    return context.get(sessionContext)
  } catch {
    return undefined
  }
}

export function tryGetRequestContext(
  context: Readonly<RouterContextProvider> | undefined,
): RequestContextValue | undefined {
  if (context === undefined) {
    return undefined
  }
  try {
    return context.get(requestContext)
  } catch {
    return undefined
  }
}

type AnyRouteArgs = {
  request: Request
  context: LoaderFunctionArgs['context']
}

export function getRouteRequestContext(args: AnyRouteArgs): RouteRequestContext {
  const context = args.context as Readonly<RouterContextProvider>
  const session = context.get(sessionContext)
  const requestData = context.get(requestContext)
  return {
    session: session.session,
    user: session.user,
    admin: session.admin,
    clientAddress: requestData.clientAddress,
    url: requestData.url,
  }
}

// ---------------------------------------------------------------------------
// Auth flows (login, install)
// ---------------------------------------------------------------------------

interface AuthFailure {
  ok: false
  status: number
  message: string
  headers: HeadersInit
}

interface AuthSuccess<T> {
  ok: true
  data: T
  headers: HeadersInit
}

export type AuthFlowResult<T> = AuthFailure | AuthSuccess<T>

async function commitHeaders(session: BlogSession, extraSetCookie?: string): Promise<HeadersInit> {
  const sessionCookie = await commitSession(session)
  if (extraSetCookie === undefined) {
    return { 'Set-Cookie': sessionCookie }
  }
  // React Router merges multiple Set-Cookie values when the response headers
  // are constructed via `Headers`, but a plain object can only carry one
  // value per key. We piggy-back on the documented "comma-joined cookie
  // headers" behaviour Node's http module accepts to emit both.
  const headers = new Headers()
  headers.append('Set-Cookie', sessionCookie)
  headers.append('Set-Cookie', extraSetCookie)
  return headers
}

async function csrfFailure(request: Request, session: BlogSession, token: string): Promise<AuthFailure | null> {
  const [valid] = await validateRequestCsrf(request, token)
  if (valid) {
    return null
  }
  return {
    ok: false,
    status: 403,
    message: '页面安全令牌已失效，请刷新后重试。',
    headers: await commitHeaders(session, await clearCsrfCookie()),
  }
}

export async function signInWithSession({
  email,
  password,
  token,
  session,
  request,
  clientAddress,
  redirectTo,
}: {
  email: string
  password: string
  token: string
  session: BlogSession
  request: Request
  clientAddress: string
  redirectTo: string
}): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrf = await csrfFailure(request, session, token)
  if (csrf) {
    return csrf
  }

  // Single Redis round-trip: increment first, branch on the post-increment
  // result. The legacy flow ran `GET (exceedLimit)` *and* `INCR (incrLimit)`
  // sequentially on every failed login.
  const limit = await tryRateLimit(clientAddress)
  if (limit.exceeded) {
    return {
      ok: false,
      status: 429,
      message: '登录失败次数过多，已锁定 30 分钟',
      headers: await commitHeaders(session),
    }
  }

  const authenticated = await login({ email, password, session, request, clientAddress })
  if (!authenticated) {
    return {
      ok: false,
      status: 403,
      message: '登录凭证无效。',
      headers: await commitHeaders(session),
    }
  }

  // Rotate the CSRF cookie on a successful login. Replaces the previous
  // `clearCsrfCookie()` (Max-Age=0) call so that any concurrently-open
  // admin tab immediately picks up a fresh, session-bound token instead
  // of having to re-fetch the form. Logout still uses `clearCsrfCookie`
  // because there's no follow-up surface that needs a token.
  const rotated = await issueCsrfToken()
  return {
    ok: true,
    data: { redirectTo },
    headers: await commitHeaders(session, rotated.setCookie),
  }
}

export async function signUpInitialAdminWithSession({
  name,
  email,
  password,
  token,
  session,
  request,
}: {
  name: string
  email: string
  password: string
  token: string
  session: BlogSession
  request: Request
}): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrf = await csrfFailure(request, session, token)
  if (csrf) {
    return csrf
  }

  if (await hasAdmin()) {
    return {
      ok: false,
      status: 409,
      message: '安装已完成',
      headers: await commitHeaders(session),
    }
  }

  const users = await insertAdmin(name, email, password)
  const admin = users[0]
  if (!admin) {
    return {
      ok: false,
      status: 500,
      message: '创建管理员账号失败',
      headers: await commitHeaders(session),
    }
  }

  session.set('user', {
    id: `${admin.id}`,
    name: admin.name,
    email: admin.email,
    website: admin.link,
    admin: true,
  })

  return {
    ok: true,
    data: { redirectTo: '/' },
    headers: await commitHeaders(session, await clearCsrfCookie()),
  }
}

// ---------------------------------------------------------------------------
// HTML form action adapter (used by `wp-login` and, when restored, `wp-admin.install`)
// ---------------------------------------------------------------------------

export async function processAuthFormSubmission<I>({
  request,
  schema,
  fields,
  defaultErrorMessage,
  redirectTo,
  run,
}: {
  request: Request
  schema: ZodType<I>
  fields: readonly string[]
  defaultErrorMessage: string
  redirectTo: string | undefined
  run: (input: I) => Promise<AuthFlowResult<{ redirectTo: string }>>
}) {
  const formData = await request.formData()
  const values: Record<string, FormDataEntryValue | null> = {}
  for (const field of fields) {
    values[field] = formData.get(field)
  }

  const parsed = schema.safeParse(values)
  if (!parsed.success) {
    return redirectTo === undefined ? { error: defaultErrorMessage } : { error: defaultErrorMessage, redirectTo }
  }

  const result = await run(parsed.data)
  if (!result.ok) {
    return data(redirectTo === undefined ? { error: result.message } : { error: result.message, redirectTo }, {
      headers: result.headers,
    })
  }

  throw redirect(result.data.redirectTo, { headers: result.headers })
}
