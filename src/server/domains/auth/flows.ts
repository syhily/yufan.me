import type { ZodType } from 'zod'

import { data, redirect } from 'react-router'

import type { BlogSession } from '@/server/domains/auth/session-storage'
import type { AssetsSettings, SiteIdentitySettings } from '@/shared/config/blog'

import { clearCsrfCookie, issueCsrfToken, validateRequestCsrf } from '@/server/domains/auth/csrf'
import { establishLoginSession, login } from '@/server/domains/auth/primitives'
import { commitSession } from '@/server/domains/auth/session-storage'
import {
  ASSETS_STORAGE_INSTALL_DEFAULTS,
  buildDefaultSectionPayloads,
  SECTION_REGISTRY,
  type SettingsSection,
} from '@/server/domains/settings/sections'
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
    headers: await commitHeaders(session, await clearCsrfCookie()),
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
  const rotated = await issueCsrfToken()
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
  headers.append('Set-Cookie', await clearCsrfCookie())
  return {
    ok: true,
    data: { redirectTo: '/wp-admin/install/settings.php' },
    headers,
  }
}

export interface InstallSettingsSeed {
  csrf: string
  title: string
  website: string
  authorEmail: string
  locale: string
  timeZone: string
  timeFormat: string
}

export async function seedInstallSettingsWithSession({
  csrf,
  title,
  website,
  authorEmail,
  locale,
  timeZone,
  timeFormat,
  admin,
  session,
  request,
}: InstallSettingsSeed & {
  admin: { id: string; name: string }
  session: BlogSession
  request: Request
}): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrfErr = await csrfFailure(request, session, csrf)
  if (csrfErr) {
    return csrfErr
  }

  const siteIdentity = buildSiteIdentitySeed({
    name: admin.name,
    title,
    website,
    authorEmail,
    locale,
    timeZone,
    timeFormat,
  })
  const assets = buildAssetsSeed({ website })

  const generalCheck = SECTION_REGISTRY.general.schema.safeParse(siteIdentity)
  if (!generalCheck.success) {
    return {
      ok: false,
      status: 400,
      message: '站点信息不符合 blog.general 的校验规则，无法初始化。',
      headers: await commitHeaders(session),
    }
  }
  const assetsCheck = SECTION_REGISTRY.assets.schema.safeParse(assets)
  if (!assetsCheck.success) {
    return {
      ok: false,
      status: 400,
      message: '资源/存储信息不符合 blog.assets 的校验规则，无法初始化。',
      headers: await commitHeaders(session),
    }
  }

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

  const updatedBy = BigInt(admin.id)
  await upsertSetting(
    generalCheck.data as unknown as Record<string, unknown>,
    updatedBy,
    SECTION_REGISTRY.general.scope,
  )
  await upsertSetting(assetsCheck.data as unknown as Record<string, unknown>, updatedBy, SECTION_REGISTRY.assets.scope)
  for (const { section, payload } of defaultSections) {
    await upsertSetting(payload, updatedBy, SECTION_REGISTRY[section].scope)
  }
  await refreshBlogSettings()

  return {
    ok: true,
    data: { redirectTo: '/wp-admin' },
    headers: await commitHeaders(session, await clearCsrfCookie()),
  }
}

function buildSiteIdentitySeed({
  name,
  title,
  website,
  authorEmail,
  locale,
  timeZone,
  timeFormat,
}: {
  name: string
  title: string
  website: string
  authorEmail: string
  locale: string
  timeZone: string
  timeFormat: string
}): SiteIdentitySettings {
  return {
    title,
    description: title,
    website,
    keywords: [],
    author: { name, email: authorEmail, url: website },
    locale,
    timeZone,
    timeFormat,
  }
}

function buildAssetsSeed({ website }: { website: string }): AssetsSettings {
  const url = new URL(website)
  return {
    asset: { host: url.host, scheme: url.protocol === 'https:' ? 'https' : 'http' },
    storage: { ...ASSETS_STORAGE_INSTALL_DEFAULTS.storage },
    upload: { ...ASSETS_STORAGE_INSTALL_DEFAULTS.upload },
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
