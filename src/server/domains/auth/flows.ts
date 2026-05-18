import type { ZodType } from 'zod'

import { data, redirect } from 'react-router'

import type { BlogSession } from '@/server/domains/auth/session-storage'
import type { AssetsSettings, SiteIdentitySettings } from '@/shared/config/blog'
import type { InstallWizardData } from '@/shared/types/install'

import { clearCsrfCookie, issueCsrfToken, validateRequestCsrf } from '@/server/domains/auth/csrf'
import { establishLoginSession, login } from '@/server/domains/auth/primitives'
import { commitSession } from '@/server/domains/auth/session-storage'
import { buildDefaultSectionPayloads, SECTION_REGISTRY, type SettingsSection } from '@/server/domains/settings/sections'
import { refreshBlogSettings } from '@/server/domains/settings/snapshot'
import { upsertSetting } from '@/server/infra/db/operations/setting'
import { hasAdmin, insertAdmin } from '@/server/infra/db/operations/user'
import { tryRateLimit } from '@/server/infra/rate-limit'

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
  const headers = new Headers()
  headers.append('Set-Cookie', sessionCookie)
  headers.append('Set-Cookie', extraSetCookie)
  return headers
}

async function csrfFailure(request: Request, session: BlogSession, csrf: string): Promise<AuthFailure | null> {
  const [valid] = await validateRequestCsrf(request, csrf)
  if (valid) {
    return null
  }
  return {
    ok: false,
    status: 403,
    message: '页面安全令牌已失效，请刷新后重试。',
    headers: await commitHeaders(session, await clearCsrfCookie(request)),
  }
}

export async function signInWithSession({
  email,
  password,
  csrf,
  session,
  request,
  clientAddress,
  redirectTo,
}: {
  email: string
  password: string
  csrf: string
  session: BlogSession
  request: Request
  clientAddress: string
  redirectTo: string
}): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrfErr = await csrfFailure(request, session, csrf)
  if (csrfErr) {
    return csrfErr
  }

  const limit = await tryRateLimit(clientAddress)
  if (limit.exceeded) {
    return {
      ok: false,
      status: 429,
      message: '登录失败次数过多，请稍后再试。',
      headers: await commitHeaders(session),
    }
  }

  const established = await login({ email, password, session, request, clientAddress })
  if (!established) {
    return {
      ok: false,
      status: 403,
      message: '登录凭证无效。',
      headers: await commitHeaders(session),
    }
  }

  // `establishLoginSession` already minted the session cookie with the
  // sid it wrote to Redis. Stack the CSRF rotation cookie on top
  // instead of re-committing the in-memory session (which would mint
  // a second, orphan sid).
  const rotated = await issueCsrfToken(request)
  const headers = new Headers()
  headers.append('Set-Cookie', established.setCookie)
  headers.append('Set-Cookie', rotated.setCookie)
  return {
    ok: true,
    data: { redirectTo },
    headers,
  }
}

export interface SignUpAdminSeed {
  name: string
  email: string
  password: string
  csrf: string
}

export async function signUpInitialAdminWithSession({
  name,
  email,
  password,
  csrf,
  session,
  request,
  clientAddress,
}: SignUpAdminSeed & {
  session: BlogSession
  request: Request
  clientAddress: string
}): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrfErr = await csrfFailure(request, session, csrf)
  if (csrfErr) {
    return csrfErr
  }

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

  const established = await establishLoginSession(session, admin, request, clientAddress)

  // Same as `signInWithSession`: `establishLoginSession` already
  // produced the session cookie keyed on the sid it wrote to Redis,
  // so we stack additional cookies (CSRF clear here) on top instead
  // of re-committing the in-memory session.
  const headers = new Headers()
  headers.append('Set-Cookie', established.setCookie)
  headers.append('Set-Cookie', await clearCsrfCookie(request))
  return {
    ok: true,
    data: { redirectTo: '/admin/install/settings.php' },
    headers,
  }
}

export interface InstallWizardSeed {
  csrf: string
  data: InstallWizardData
  admin: { id: string; name: string; email: string }
  session: BlogSession
  request: Request
}

export async function seedInstallSettingsWithSession({
  csrf,
  data,
  admin,
  session,
  request,
}: InstallWizardSeed): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrfErr = await csrfFailure(request, session, csrf)
  if (csrfErr) {
    return csrfErr
  }

  // ── Build per-section payloads from wizard data ──
  const siteIdentity: SiteIdentitySettings = {
    title: data.title,
    description: data.description,
    website: data.website,
    keywords: data.keywords,
    author: { name: admin.name, email: admin.email, url: data.website },
    locale: data.locale,
    timeZone: data.timeZone,
    timeFormat: data.timeFormat,
    initialYear: data.initialYear,
    icpNo: data.icpNo,
    moeIcpNo: data.moeIcpNo,
  }

  const assets: AssetsSettings = {
    asset: data.assets.asset,
    storage: data.assets.storage,
    upload: data.assets.upload,
  }

  const defaultPayloads = buildDefaultSectionPayloads()
  const defaultMap = new Map<SettingsSection, Record<string, unknown>>(
    defaultPayloads.map((d) => [d.section, d.payload]),
  )

  const sections: { section: SettingsSection; payload: Record<string, unknown> }[] = [
    { section: 'general', payload: siteIdentity as unknown as Record<string, unknown> },
    { section: 'assets', payload: assets as unknown as Record<string, unknown> },
    { section: 'navigation', payload: { navigation: data.navigation } as Record<string, unknown> },
    { section: 'socials', payload: { socials: data.socials } as Record<string, unknown> },
    { section: 'content', payload: data.content as unknown as Record<string, unknown> },
    { section: 'sidebar', payload: { sidebar: data.sidebar } as Record<string, unknown> },
    { section: 'comments', payload: { comments: data.comments } as Record<string, unknown> },
    { section: 'seo', payload: defaultMap.get('seo') ?? {} },
    { section: 'mail', payload: { mail: data.mail } as Record<string, unknown> },
    { section: 'cache', payload: defaultMap.get('cache') ?? {} },
    { section: 'rateLimit', payload: defaultMap.get('rateLimit') ?? {} },
    { section: 'search', payload: { search: data.search } as Record<string, unknown> },
    { section: 'fonts', payload: data.fonts as unknown as Record<string, unknown> },
  ]

  // ── Validate every section against its schema ──
  for (const { section, payload } of sections) {
    const meta = SECTION_REGISTRY[section]
    const check = meta.schema.safeParse(payload)
    if (!check.success) {
      const first = check.error.issues[0]
      const path = first ? first.path.join('.') : '<unknown>'
      return {
        ok: false,
        status: 400,
        message: `${meta.scope} 校验失败（${path}）：${first?.message ?? '未知错误'}`,
        headers: await commitHeaders(session),
      }
    }
  }

  // ── Write all sections ──
  const updatedBy = BigInt(admin.id)
  for (const { section, payload } of sections) {
    const meta = SECTION_REGISTRY[section]
    const check = meta.schema.safeParse(payload)
    if (check.success) {
      await upsertSetting(check.data as Record<string, unknown>, updatedBy, meta.scope)
    }
  }

  await refreshBlogSettings()

  return {
    ok: true,
    data: { redirectTo: '/admin/welcome' },
    headers: await commitHeaders(session, await clearCsrfCookie(request)),
  }
}

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
