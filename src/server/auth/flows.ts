import type { ZodType } from 'zod'

import { data, redirect } from 'react-router'

import type { BlogSession } from '@/server/auth/session-storage'
import type { AssetsSettings, SiteIdentitySettings } from '@/shared/blog-config'

import { clearCsrfCookie, issueCsrfToken, validateRequestCsrf } from '@/server/auth/csrf'
import { login } from '@/server/auth/primitives'
import { commitSession } from '@/server/auth/session-storage'
import { upsertSetting } from '@/server/db/query/setting'
import { hasAdmin, insertAdmin } from '@/server/db/query/user'
import { tryRateLimit } from '@/server/rate-limit'
import {
  ASSETS_STORAGE_INSTALL_DEFAULTS,
  buildDefaultSectionPayloads,
  SECTION_REGISTRY,
  type SettingsSection,
} from '@/server/settings/sections'
import { refreshBlogSettings } from '@/server/settings/snapshot'

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

  const limit = await tryRateLimit(clientAddress)
  if (limit.exceeded) {
    return {
      ok: false,
      status: 429,
      message: '登录失败次数过多，请稍后再试。',
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

  const rotated = await issueCsrfToken()
  return {
    ok: true,
    data: { redirectTo },
    headers: await commitHeaders(session, rotated.setCookie),
  }
}

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
  if (csrf) {
    return csrf
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

  session.set('user', {
    id: `${admin.id}`,
    name: admin.name,
    email: admin.email,
    website: admin.link,
    role: 'admin',
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
  title: string
  website: string
  authorEmail: string
  assetHost: string
  assetScheme: 'http' | 'https'
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
  admin: { id: string; name: string }
  session: BlogSession
  request: Request
}): Promise<AuthFlowResult<{ redirectTo: string }>> {
  const csrf = await csrfFailure(request, session, token)
  if (csrf) {
    return csrf
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
  const assets = buildAssetsSeed({ assetHost, assetScheme })

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

function buildAssetsSeed({
  assetHost,
  assetScheme,
}: {
  assetHost: string
  assetScheme: 'http' | 'https'
}): AssetsSettings {
  return {
    asset: { host: assetHost, scheme: assetScheme },
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
