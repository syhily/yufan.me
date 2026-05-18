import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { emptySession } from './_helpers/session'

// `signInWithSession` is the single entry-point both the public admin login
// route and integration-style harnesses use to authenticate. We pin the two
// behavioural guarantees that are easy to silently regress:
//
//   1. The successful response carries BOTH a `__session` cookie (so the
//      browser persists the new login) AND a rotated `csrf-token` cookie
//      (so any concurrently-open admin tab picks up a fresh, session-bound
//      token without having to re-fetch the form).
//   2. The rate limiter only round-trips Redis once per attempt (the
//      legacy `exceedLimit` + `incrLimit` pair was collapsed into
//      `tryRateLimit`).

// Stub Redis: the cookie-backed `createSessionStorage` writes the encrypted
// session id to Redis on commit and reads it back for `getSession`. The
// flow test only cares about the Set-Cookie surface, so a no-op Redis is
// enough; we do *not* mock `commitSession` itself, because the merged
// `signInWithSession` (in the same module) would still see the real export
// — `vi.mock` only swaps the module's *named* exports, not internal calls.
vi.mock('@/server/infra/redis/storage', () => ({
  redisInstance: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    sadd: vi.fn(async () => 1),
    srem: vi.fn(async () => 1),
    smembers: vi.fn(async () => []),
    // Session metadata writes added in the session-management feature.
    // Stubs return success so `establishLoginSession` proceeds without
    // touching a real Redis.
    hset: vi.fn(async () => 1),
    hgetall: vi.fn(async () => ({})),
    pexpireat: vi.fn(async () => 1),
    pipeline: () => ({ del: () => {}, exec: vi.fn(async () => []) }),
  }),
}))

vi.mock('@/server/infra/db/operations/user', () => ({
  hasAdmin: vi.fn(async () => false),
  insertAdmin: vi.fn(async () => []),
  verifyUserPassword: vi.fn(),
  updateLastLogin: vi.fn(async () => undefined),
}))

vi.mock('@/server/infra/db/operations/setting', () => ({
  upsertSetting: vi.fn(async () => undefined),
  findSettingByScope: vi.fn(async () => null),
}))

vi.mock('@/server/domains/settings/snapshot', () => ({
  refreshBlogSettings: vi.fn(async () => null),
}))

vi.mock('@/server/infra/rate-limit', () => ({
  tryRateLimit: vi.fn(async () => ({ count: 1, exceeded: false })),
}))

const userQuery = await import('@/server/infra/db/operations/user')
const settingQuery = await import('@/server/infra/db/operations/setting')
const settingsSnapshot = await import('@/server/domains/settings/snapshot')
const rateLimit = await import('@/server/infra/rate-limit')
import { issueCsrfToken } from '@/server/domains/auth/csrf'
import {
  seedInstallSettingsWithSession,
  signInWithSession,
  signUpInitialAdminWithSession,
} from '@/server/domains/auth/flows'

const verifyUserPasswordMock = vi.mocked(userQuery.verifyUserPassword)

beforeEach(() => {
  verifyUserPasswordMock.mockReset()
  vi.mocked(userQuery.hasAdmin).mockReset()
  vi.mocked(userQuery.hasAdmin).mockResolvedValue(false)
  vi.mocked(userQuery.insertAdmin).mockReset()
  vi.mocked(userQuery.insertAdmin).mockResolvedValue([])
  vi.mocked(settingQuery.upsertSetting).mockReset()
  vi.mocked(settingsSnapshot.refreshBlogSettings).mockReset()
  vi.mocked(rateLimit.tryRateLimit).mockReset()
  vi.mocked(rateLimit.tryRateLimit).mockResolvedValue({ count: 1, exceeded: false })
})

function setCookieHeaders(headers: HeadersInit): string[] {
  if (headers instanceof Headers) {
    return headers.getSetCookie()
  }
  // Plain-object header path is used only on the empty-CSRF code branch;
  // surface it as a single-element array for symmetric test assertions.
  const value = (headers as Record<string, string>)['Set-Cookie']
  return value ? [value] : []
}

async function buildSignedRequest(token: string): Promise<{ request: Request; token: string }> {
  const issued = token === '' ? await issueCsrfToken() : { token, setCookie: '' }
  const cookie = issued.setCookie === '' ? '' : issued.setCookie.split(';')[0]!
  const request = new Request('http://localhost/admin/signin', {
    method: 'POST',
    headers: cookie ? { Cookie: cookie } : {},
  })
  return { request, token: issued.token }
}

// `login()` reads the password through `verifyUserPassword`. Returning a
// non-null record makes `login()` resolve `true`, returning `null` makes it
// resolve `false` — without us having to spy on `login` itself.
const stubUser = {
  id: 1,
  name: 'Admin',
  email: 'admin@yufan.me',
  link: null,
  role: 'admin',
} as never

describe('services/auth/flow — signInWithSession', () => {
  it('on success emits both a session cookie and a freshly-rotated CSRF cookie', async () => {
    verifyUserPasswordMock.mockResolvedValue(stubUser)
    const { request, token } = await buildSignedRequest('')

    const result = await signInWithSession({
      email: 'admin@yufan.me',
      password: 'correct horse',
      csrf: token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
      redirectTo: '/admin',
    })

    expect(result.ok).toBe(true)
    const cookies = setCookieHeaders(result.headers)
    // Two distinct cookies must travel back: the session one and the
    // rotated CSRF one. `getSetCookie()` preserves them as separate values
    // (a plain-object header would silently overwrite), which is exactly
    // why the success path constructs a `Headers` instance.
    expect(cookies.some((c) => c.startsWith('__session='))).toBe(true)
    expect(cookies.some((c) => c.startsWith('csrf-token='))).toBe(true)
    // The new CSRF cookie carries a non-empty value (a `clearCsrfCookie`
    // regression would emit `csrf-token=; Max-Age=0`).
    const csrf = cookies.find((c) => c.startsWith('csrf-token='))!
    const value = csrf.split(';')[0].split('=')[1]
    expect(value.length).toBeGreaterThan(10)
    expect(csrf).toMatch(/HttpOnly/i)
    expect(csrf).toMatch(/SameSite=Lax/i)
  })

  it('only round-trips Redis once per attempt (no separate exceedLimit GET)', async () => {
    verifyUserPasswordMock.mockResolvedValue(stubUser)
    const { request, token } = await buildSignedRequest('')

    await signInWithSession({
      email: 'admin@yufan.me',
      password: 'correct horse',
      csrf: token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
      redirectTo: '/admin',
    })

    expect(rateLimit.tryRateLimit).toHaveBeenCalledTimes(1)
    expect(rateLimit.tryRateLimit).toHaveBeenCalledWith('127.0.0.1')
  })

  it('returns 429 (and never invokes login) when the rate limiter trips', async () => {
    vi.mocked(rateLimit.tryRateLimit).mockResolvedValue({ count: 99, exceeded: true })
    const { request, token } = await buildSignedRequest('')

    const result = await signInWithSession({
      email: 'admin@yufan.me',
      password: 'correct horse',
      csrf: token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
      redirectTo: '/admin',
    })

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.status).toBe(429)
    }
    expect(verifyUserPasswordMock).not.toHaveBeenCalled()
  })

  it('returns 403 with no rotated CSRF cookie on bad credentials', async () => {
    verifyUserPasswordMock.mockResolvedValue(null)
    const { request, token } = await buildSignedRequest('')

    const result = await signInWithSession({
      email: 'admin@yufan.me',
      password: 'wrong',
      csrf: token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
      redirectTo: '/admin',
    })

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.status).toBe(403)
    }
    const cookies = setCookieHeaders(result.headers)
    expect(cookies.some((c) => c.startsWith('csrf-token='))).toBe(false)
  })
})

describe('services/auth/flow — signUpInitialAdminWithSession (install stage 1)', () => {
  const baseSeed = {
    name: 'Admin',
    email: 'admin@yufan.me',
    password: 'correct horse staple battery',
  }

  it('creates the admin row and redirects to stage 2', async () => {
    vi.mocked(userQuery.insertAdmin).mockResolvedValue([
      { id: 7n, name: 'Admin', email: 'admin@yufan.me', link: '', role: 'admin' } as never,
    ])
    const { request, token } = await buildSignedRequest('')

    const result = await signUpInitialAdminWithSession({
      ...baseSeed,
      csrf: token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
    })

    expect(result.ok).toBe(true)
    if (result.ok === true) {
      expect(result.data.redirectTo).toBe('/admin/install/settings.php')
    }
    expect(userQuery.insertAdmin).toHaveBeenCalledWith('Admin', 'admin@yufan.me', baseSeed.password)
    expect(settingQuery.upsertSetting).not.toHaveBeenCalled()
    expect(settingsSnapshot.refreshBlogSettings).not.toHaveBeenCalled()
  })

  it('refuses a duplicate stage-1 install (returns 409, no DB writes)', async () => {
    vi.mocked(userQuery.hasAdmin).mockResolvedValue(true)
    const { request, token } = await buildSignedRequest('')

    const result = await signUpInitialAdminWithSession({
      ...baseSeed,
      csrf: token,
      session: emptySession(),
      request,
      clientAddress: '127.0.0.1',
    })

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.status).toBe(409)
    }
    expect(userQuery.insertAdmin).not.toHaveBeenCalled()
  })

  it('returns 403 and never touches the DB when the CSRF token is missing', async () => {
    const result = await signUpInitialAdminWithSession({
      ...baseSeed,
      csrf: '',
      session: emptySession(),
      request: new Request('http://localhost/admin/install.php', { method: 'POST' }),
      clientAddress: '127.0.0.1',
    })

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.status).toBe(403)
    }
    expect(userQuery.insertAdmin).not.toHaveBeenCalled()
  })
})

describe('services/auth/flow — seedInstallSettingsWithSession (install stage 2)', () => {
  const baseWizardData = {
    title: 'Yufan Blog',
    description: 'Yufan Blog Description',
    website: 'https://yufan.me',
    keywords: [],
    locale: 'zh-CN',
    timeZone: 'Asia/Shanghai',
    timeFormat: 'yyyy-LL-dd HH:mm',
    initialYear: new Date().getFullYear(),
    icpNo: '',
    moeIcpNo: '',
    navigation: { sideNav: [], footerNav: [] },
    socials: [],
    sidebar: {
      widgets: [
        { type: 'search' as const, enabled: false },
        { type: 'recentPosts' as const, enabled: false, count: 5 },
        { type: 'recentComments' as const, enabled: false, count: 5 },
        { type: 'randomTags' as const, enabled: false, count: 20 },
        { type: 'todayCalendar' as const, enabled: false },
      ],
    },
    fonts: { og: { url: '' }, calendar: { url: '' }, globalCss: [], postCss: [] },
    content: {
      pagination: { posts: 10, category: 10, tags: 10, search: 10 },
      feed: { full: false, size: 20 },
      post: { sort: 'desc' as const, sortBy: 'publishedAt' as const, featureEnabled: false },
      footnotes: { sectionTitle: '尾声礼记' },
    },
    comments: {
      size: 10,
      avatar: { mirror: 'https://www.gravatar.com/avatar', size: 80 },
      tokenTtlSeconds: 1800,
    },
    assets: {
      asset: { host: 'yufan.me', scheme: 'https' as const },
      storage: {
        enabled: false,
        endpoint: '',
        region: '',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: false,
        urlTemplate: '',
      },
      upload: { maxBytes: 8 * 1024 * 1024, jpegQuality: 82 },
    },
    mail: { enabled: false, host: 'api.zeabur.com', apiKey: '', sender: 'noreply@example.com' },
    search: {
      enabled: false,
      mode: 'like' as const,
      endpoint: '',
      apiKey: '',
      model: 'text-embedding-3-small',
      similarityThreshold: 0.5,
    },
  }
  const adminCtx = { id: '7', name: 'Admin', email: 'mailbox@yufan.me' }

  it('seeds the settings row using the authenticated admin id', async () => {
    const { request, token } = await buildSignedRequest('')

    const result = await seedInstallSettingsWithSession({
      data: baseWizardData,
      csrf: token,
      admin: adminCtx,
      session: emptySession(),
      request,
    })

    expect(result.ok).toBe(true)
    if (result.ok === true) {
      expect(result.data.redirectTo).toBe('/admin/welcome')
    }
    // user-driven rows (`blog.general` for the site identity AND the
    // locale/timeZone/timeFormat trio, `blog.assets` for the music CDN
    // host plus the conservative S3 defaults) come from the form, and
    // the remaining 9 rows come from the registry's per-section
    // `defaults` payloads. The S3 storage toggle defaults to OFF —
    // the admin opts in by flipping it on later from
    // `/admin/settings/assets`. Writing every row up front means
    // the very first public render after install can use the strict
    // per-section hooks (`useFooterSettings()`, `useNavigationSettings()`,
    // …) without throwing on a `null` bucket.
    expect(settingQuery.upsertSetting).toHaveBeenCalledTimes(13)
    const calls = vi.mocked(settingQuery.upsertSetting).mock.calls
    const byScope = new Map<string, { data: Record<string, unknown>; updatedBy: bigint | null }>()
    for (const [data, updatedBy, scope] of calls) {
      byScope.set(scope, { data: data as Record<string, unknown>, updatedBy })
    }
    expect([...byScope.keys()].sort()).toEqual([
      'blog.assets',
      'blog.cache',
      'blog.comments',
      'blog.content',
      'blog.fonts',
      'blog.general',
      'blog.mail',
      'blog.navigation',
      'blog.rateLimit',
      'blog.search',
      'blog.seo',
      'blog.sidebar',
      'blog.socials',
    ])

    const general = byScope.get('blog.general')
    expect(general).toBeDefined()
    expect(general?.data.title).toBe('Yufan Blog')
    expect(general?.data.website).toBe('https://yufan.me')
    // The general row also carries the date-formatter inputs after
    // the localization+general merge.
    expect(general?.data.locale).toBe('zh-CN')
    expect(general?.data.timeZone).toBe('Asia/Shanghai')
    expect(general?.data.timeFormat).toBe('yyyy-LL-dd HH:mm')
    // Asset host / scheme belong to the sibling assets row.
    expect(general?.data.asset).toBeUndefined()
    expect(general?.updatedBy).toBe(7n)
    // The seed payload MUST already satisfy `generalSchema` — the
    // first thing the admin will do is open `/admin/settings/general`
    // and click 保存, which re-validates the same row through the
    // strict per-section schema. A drifted seed would silently break
    // the very first edit. Spot-check the constraints that historically
    // tripped: `description` is `min(1)` so it cannot be the empty
    // string, and `keywords` must be an array (even if empty).
    const generalDescription = general?.data.description
    expect(typeof generalDescription).toBe('string')
    expect((generalDescription as string).length).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(general?.data.keywords)).toBe(true)
    expect(general?.data.author).toMatchObject({
      name: 'Admin',
      email: 'mailbox@yufan.me',
      url: 'https://yufan.me',
    })

    const assets = byScope.get('blog.assets')
    expect(assets).toBeDefined()
    expect(assets?.data.asset).toEqual({ host: 'yufan.me', scheme: 'https' })
    // The install seed contributes the conservative S3 defaults
    // (toggle OFF, every bucket field empty) alongside the
    // user-supplied asset host. The admin opts into S3 later from
    // `/admin/settings/assets` once they have credentials ready.
    const assetsData = assets!.data as Record<string, unknown>
    const assetsStorage = assetsData.storage as Record<string, unknown>
    expect(assetsStorage.enabled).toBe(false)
    expect(assetsStorage.endpoint).toBe('')
    expect(assetsStorage.secretAccessKey).toBe('')
    const assetsUpload = assetsData.upload as Record<string, unknown>
    expect(assetsUpload.maxBytes).toBe(8 * 1024 * 1024)
    expect(assetsUpload.jpegQuality).toBe(82)
    // Asset row carries no identity fields — those live on the sibling
    // `blog.general` row.
    expect(assets?.data.title).toBeUndefined()
    expect(assets?.data.locale).toBeUndefined()
    expect(assets?.updatedBy).toBe(7n)

    // Spot-check the seeded defaults: each row's payload must match
    // its bucket DTO shape verbatim (no extra `settings` nesting) and
    // must already satisfy the matching per-section schema. The full
    // schema validation is what `buildDefaultSectionPayloads()` does
    // internally, so reaching this point at all proves the registry
    // defaults are valid.
    expect(byScope.get('blog.navigation')?.data).toEqual({ navigation: { sideNav: [], footerNav: [] } })
    expect(byScope.get('blog.socials')?.data).toEqual({ socials: [] })
    expect((general!.data as Record<string, unknown>).initialYear).toEqual(expect.any(Number))
    const cache = byScope.get('blog.cache')?.data
    expect(cache).toBeDefined()
    const cacheBuckets = (cache as Record<string, unknown>).cache as Record<string, Record<string, unknown>>
    expect(cacheBuckets.og.prefix).toBe('og:')
    expect(cacheBuckets.calendar.prefix).toBe('calendar:')
    expect(cacheBuckets.avatar.prefix).toBe('avatar:')
    // The rate-limit row's seeded buckets mirror the historical
    // hard-coded thresholds so an upgrading deployment behaves
    // identically until the admin tunes the caps from
    // `/admin/settings/rate-limit`.
    const rateLimit = byScope.get('blog.rateLimit')?.data
    expect(rateLimit).toBeDefined()
    expect(rateLimit).toMatchObject({
      signInIp: { windowSeconds: 60 * 30, maxAttempts: 5 },
      commentPostIp: { windowSeconds: 60 * 60, maxAttempts: 12 },
      commentPostEmail: { windowSeconds: 60 * 60, maxAttempts: 8 },
      likeIncreaseIp: { windowSeconds: 60 * 60, maxAttempts: 30 },
    })
    // All seeded rows share the same `updatedBy` (the admin who
    // install actor from the row metadata alone.
    for (const entry of byScope.values()) {
      expect(entry.updatedBy).toBe(7n)
    }

    // The synchronous reader is force-refreshed so the `/admin`
    // redirect lands on a hydrated snapshot.
    expect(settingsSnapshot.refreshBlogSettings).toHaveBeenCalledOnce()
    // session before calling this helper.
    expect(userQuery.insertAdmin).not.toHaveBeenCalled()
  })

  it('returns 403 and never touches the DB when the CSRF token is missing', async () => {
    const result = await seedInstallSettingsWithSession({
      data: baseWizardData,
      csrf: '',
      admin: adminCtx,
      session: emptySession(),
      request: new Request('http://localhost/admin/install/settings.php', { method: 'POST' }),
    })

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.status).toBe(403)
    }
    expect(settingQuery.upsertSetting).not.toHaveBeenCalled()
    expect(settingsSnapshot.refreshBlogSettings).not.toHaveBeenCalled()
  })
})
