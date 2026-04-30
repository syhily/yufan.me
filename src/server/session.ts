import type { LoaderFunctionArgs, MiddlewareFunction, RouterContextProvider, Session } from 'react-router'
import type { ZodType } from 'zod'

import { createContext, createCookie, createSessionStorage, data, redirect } from 'react-router'

import type { LocalizationSettings, SiteIdentitySettings } from '@/shared/blog-config'

import { redisInstance } from '@/server/cache/storage'
import { upsertSetting } from '@/server/db/query/setting'
import { hasAdmin, insertAdmin, updateLastLogin, verifyUserPassword } from '@/server/db/query/user'
import { SESSION_SECRET } from '@/server/env'
import { tryRateLimit } from '@/server/rate-limit'
import { buildDefaultSectionPayloads, SECTION_REGISTRY, type SettingsSection } from '@/server/settings/sections'
import { refreshBlogSettings } from '@/server/settings/snapshot'
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
    if (!value) return null
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

// `RouterContextProvider` only stores values for keys that have been written.
// Reads on missing keys throw, so we guard against tests / direct unit
// invocations of route handlers that bypass the middleware perimeter.
export function tryGetSessionContext(context: Readonly<RouterContextProvider> | undefined): SessionContext | undefined {
  if (context === undefined) return undefined
  try {
    return context.get(sessionContext)
  } catch {
    return undefined
  }
}

export function tryGetRequestContext(
  context: Readonly<RouterContextProvider> | undefined,
): RequestContextValue | undefined {
  if (context === undefined) return undefined
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
  if (valid) return null
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
  if (csrf) return csrf

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

// Two-stage install. Replaces the legacy `installBlogWithSession`
// helper that did everything in one POST.
//
// STAGE 1 — `signUpInitialAdminWithSession`: insert the very first
//           admin row, then auto-login the new user so the redirect to
//           stage 2 is already authenticated. Refuses to run when an
//           admin already exists.
// STAGE 2 — `seedInstallSettingsWithSession`: persist the `setting`
//           row at scope `blog` and refresh the snapshot. Requires a
//           live admin session (the action route enforces that via the
//           usual `getRouteRequestContext({ admin })` check), and
//           refuses to run when a settings row is already present.
//
// The admin row written in stage 1 is meaningful on its own (a half-
// installed deployment can still log in via `/wp-login.php`), and an
// absent settings row simply re-triggers the install gate's redirect
// to stage 2. There is no transactional invariant between the two
// writes, so the split is purely operational.

export interface SignUpAdminSeed {
  name: string
  email: string
  password: string
  token: string
}

export async function signUpInitialAdminWithSession({
  name,
  email,
  password,
  token,
  session,
  request,
}: SignUpAdminSeed & {
  session: BlogSession
  request: Request
}): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrf = await csrfFailure(request, session, token)
  if (csrf) return csrf

  if (await hasAdmin()) {
    return {
      ok: false,
      status: 409,
      message: '管理员账号已存在，请直接登录后继续初始化。',
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

  // Auto-login the freshly-created admin so the stage-2 redirect lands
  // on a fully authenticated request. The install gate's stage-2 check
  // (`/wp-admin/install/settings.php`) refuses anonymous traffic, so
  // skipping this would force the user through `/wp-login.php` first.
  session.set('user', {
    id: `${admin.id}`,
    name: admin.name,
    email: admin.email,
    website: admin.link,
    admin: true,
  })

  return {
    ok: true,
    data: { redirectTo: '/wp-admin/install/settings.php' },
    headers: await commitHeaders(session, await clearCsrfCookie()),
  }
}

export interface InstallSettingsSeed {
  token: string
  // Site identity
  title: string
  website: string
  authorEmail: string
  // Asset CDN
  assetHost: string
  assetScheme: 'http' | 'https'
  // Localization
  locale: string
  timeZone: string
  timeFormat: string
}

export async function seedInstallSettingsWithSession({
  token,
  title,
  website,
  authorEmail,
  assetHost,
  assetScheme,
  locale,
  timeZone,
  timeFormat,
  admin,
  session,
  request,
}: InstallSettingsSeed & {
  /** The currently authenticated admin (caller is the wp-admin route). */
  admin: { id: string; name: string }
  session: BlogSession
  request: Request
}): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrf = await csrfFailure(request, session, token)
  if (csrf) return csrf

  const siteIdentity = buildSiteIdentitySeed({
    name: admin.name,
    title,
    website,
    authorEmail,
  })
  const localization = buildLocalizationSeed({
    assetHost,
    assetScheme,
    locale,
    timeZone,
    timeFormat,
  })

  // Defence in depth: the install form's flat `installSettingsSchema`
  // and each section's `generalSchema` / `localizationSchema` have the
  // same constraints today, but they live in separate files and could
  // drift. Re-validating the assembled seed against the canonical
  // section schemas at the perimeter means a future schema change
  // (e.g. a new required field) fails the install flow loudly instead
  // of writing a row that any later admin save would silently reject.
  const generalCheck = SECTION_REGISTRY.general.schema.safeParse(siteIdentity)
  if (!generalCheck.success) {
    return {
      ok: false,
      status: 400,
      message: '站点信息不符合 blog.general 的校验规则，无法初始化。',
      headers: await commitHeaders(session),
    }
  }
  const localizationCheck = SECTION_REGISTRY.localization.schema.safeParse(localization)
  if (!localizationCheck.success) {
    return {
      ok: false,
      status: 400,
      message: '本地化信息不符合 blog.localization 的校验规则，无法初始化。',
      headers: await commitHeaders(session),
    }
  }

  // Pre-validate the 9 optional sections' default seed payloads up
  // front through `buildDefaultSectionPayloads()`. The helper throws
  // if a registry default no longer satisfies its schema (a programmer
  // bug in `sections.ts`, not user data), so we catch and surface a
  // 500 instead of letting the throw bubble to the route boundary.
  let defaultSections: { section: SettingsSection; payload: Record<string, unknown> }[]
  try {
    defaultSections = buildDefaultSectionPayloads()
  } catch (error) {
    return {
      ok: false,
      status: 500,
      message: error instanceof Error ? `内置默认值校验失败：${error.message}` : '内置默认值校验失败。',
      headers: await commitHeaders(session),
    }
  }

  // `setting.updatedBy` is `bigint | null`; the session/admin id is a
  // string in the cookie payload but corresponds to the same column.
  // Writes are serialised here for clarity (one row at a time); they
  // could go in parallel because each row is keyed on a distinct unique
  // `scope`, but the install flow is not latency-sensitive and the
  // serialised order makes a partial-failure crash report easier to
  // read. All 11 sections are written at install time so the very
  // first public request after install never observes a `null`
  // section bucket — the strict per-section hooks
  // (`useFooterSettings()`, `useNavigationSettings()`, …) all resolve
  // immediately. The admin can still tune any section later from the
  // matching `/wp-admin/settings/*` page.
  const updatedBy = BigInt(admin.id)
  await upsertSetting(
    generalCheck.data as unknown as Record<string, unknown>,
    updatedBy,
    SECTION_REGISTRY.general.scope,
  )
  await upsertSetting(
    localizationCheck.data as unknown as Record<string, unknown>,
    updatedBy,
    SECTION_REGISTRY.localization.scope,
  )
  for (const { section, payload } of defaultSections) {
    await upsertSetting(payload, updatedBy, SECTION_REGISTRY[section].scope)
  }
  // Force the in-process snapshot to pick up the freshly-written rows
  // so the very next request (the redirect to `/wp-admin`) sees the
  // live values from the synchronous reader without waiting for the
  // next hydration tick.
  await refreshBlogSettings()

  return {
    ok: true,
    data: { redirectTo: '/wp-admin' },
    headers: await commitHeaders(session, await clearCsrfCookie()),
  }
}

// Build the `blog.general` row contents. `author.name` is sourced from
// the admin row created in stage 1 so the editor doesn't have to
// re-type it; `description` is bootstrapped from the title so the
// row satisfies `generalSchema` (which requires `description.min(1)`)
// — without a non-empty seed the very first save from
// `/wp-admin/settings/general` would silently reject the form. The
// admin can overwrite the description any time from the same page.
// `keywords` stays empty: the schema only enforces a max length, an
// empty array is valid.
function buildSiteIdentitySeed({
  name,
  title,
  website,
  authorEmail,
}: {
  name: string
  title: string
  website: string
  authorEmail: string
}): SiteIdentitySettings {
  return {
    title,
    description: title,
    website,
    keywords: [],
    author: { name, email: authorEmail, url: website },
  }
}

// Build the `blog.localization` row contents. The CDN host / scheme
// MUST match the deployment-time `ASSET_HOST` / `ASSET_SCHEME` env
// vars consumed by the build-time MDX pipeline; the install form
// surfaces both knobs side-by-side so the editor sees the coupling.
function buildLocalizationSeed({
  assetHost,
  assetScheme,
  locale,
  timeZone,
  timeFormat,
}: {
  assetHost: string
  assetScheme: 'http' | 'https'
  locale: string
  timeZone: string
  timeFormat: string
}): LocalizationSettings {
  return {
    asset: { host: assetHost, scheme: assetScheme },
    locale,
    timeZone,
    timeFormat,
  }
}

// ---------------------------------------------------------------------------
// HTML form action adapter (used by `wp-login` and `wp-admin.install`)
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
  for (const field of fields) values[field] = formData.get(field)

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
