import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Setting } from '@/server/db/types'
import type { BlogSettings, BlogSettingsBundle } from '@/shared/blog-config'

vi.mock('@/server/db/query/setting', () => ({
  findSettingByScope: vi.fn(),
  findSettingsByScopePrefix: vi.fn(),
  upsertSetting: vi.fn(),
}))

const settingQueries = await import('@/server/db/query/setting')
const { getAdminBlogSettings, updateBlogSettingsSection } = await import('@/server/settings/service')
const { setBlogSettingsBundleForTests, getBlogConfigSync } = await import('@/server/settings/snapshot')
const { ActionFailure } = await import('@/server/route-helpers/api-handler')
const { blogSettingsToBundle } = await import('@/shared/blog-config')

// Reusable `BlogSettings` fixture. The on-disk DB now stores one row
// per section (`blog.general`, `blog.localization`, …) so the helper
// `bundleRows()` decomposes the legacy aggregated shape into the
// per-row format that `findSettingsByScopePrefix` would return.
const fixture: BlogSettings = {
  title: 'fixture title',
  description: 'fixture description',
  website: 'https://example.com',
  keywords: [],
  author: { name: 'tester', email: 'test@example.com', url: 'https://example.com' },
  navigation: [],
  socials: [],
  settings: {
    asset: { host: 'cdn.example.com', scheme: 'https' },
    locale: 'zh-CN',
    timeZone: 'UTC',
    timeFormat: 'yyyy-LL-dd HH:mm',
    twitter: '',
    pagination: { posts: 12, category: 12, tags: 12, search: 12 },
    feed: { full: false, size: 20 },
    post: { sort: 'desc' },
    sidebar: { calendar: true, search: true, comment: 5, post: 5, tag: 20 },
    comments: { size: 10, avatar: { mirror: 'https://cdn.example.com/avatar', size: 80 } },
    toc: { minHeadingLevel: 2, maxHeadingLevel: 4 },
    og: { width: 1200, height: 630 },
    footer: { initialYear: 2024 },
    mail: { enabled: false, host: '', apiKey: '', sender: '' },
    cache: {
      og: { prefix: 'og:', ttlSeconds: 3600 },
      calendar: { prefix: 'calendar:', ttlSeconds: 3600 },
      avatar: { prefix: 'avatar:', ttlSeconds: 3600 },
    },
  },
}

const fixtureBundle: BlogSettingsBundle = blogSettingsToBundle(fixture)

// Decompose the bundle into the actual `Setting[]` rows the DB would
// return — one row per non-null section, keyed by the registry scope.
function bundleRows(bundle: BlogSettingsBundle): Setting[] {
  const map: Record<keyof BlogSettingsBundle, string> = {
    siteIdentity: 'blog.general',
    localization: 'blog.localization',
    navigation: 'blog.navigation',
    socials: 'blog.socials',
    content: 'blog.content',
    sidebar: 'blog.sidebar',
    comments: 'blog.comments',
    seo: 'blog.seo',
    footer: 'blog.footer',
    mail: 'blog.mail',
    cache: 'blog.cache',
  }
  const rows: Setting[] = []
  let id = 1n
  for (const key of Object.keys(map) as (keyof BlogSettingsBundle)[]) {
    const value = bundle[key]
    if (value === null) continue
    rows.push({
      id: id++,
      scope: map[key],
      data: value as unknown as Record<string, unknown>,
      updatedAt: new Date(),
      updatedBy: null,
    } as Setting)
  }
  return rows
}

beforeEach(() => {
  vi.mocked(settingQueries.findSettingByScope).mockReset()
  vi.mocked(settingQueries.findSettingsByScopePrefix).mockReset()
  vi.mocked(settingQueries.upsertSetting).mockReset()
  setBlogSettingsBundleForTests(undefined)
})

describe('services/settings — getAdminBlogSettings', () => {
  it('returns null when no DB rows exist (pre-install)', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    const dto = await getAdminBlogSettings()

    expect(dto.settings).toBeNull()
    expect(dto.bundle).toBeNull()
  })

  it('returns the assembled bundle when every section row passes the shape probe', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue(bundleRows(fixtureBundle))

    const dto = await getAdminBlogSettings()

    expect(dto.bundle).not.toBeNull()
    expect(dto.bundle?.siteIdentity?.title).toBe(fixture.title)
    expect(dto.bundle?.sidebar?.sidebar.calendar).toBe(true)
    // Legacy projection still populated for downstream `BlogSettings`
    // consumers.
    expect(dto.settings).not.toBeNull()
    expect(dto.settings?.title).toBe(fixture.title)
  })

  it('treats a deployment as uninstalled when only some sections exist', async () => {
    // Only siteIdentity present; the snapshot module requires both
    // siteIdentity AND localization to consider the deployment
    // installed.
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([
      {
        id: 1n,
        scope: 'blog.general',
        data: fixtureBundle.siteIdentity as unknown as Record<string, unknown>,
        updatedAt: new Date(),
        updatedBy: null,
      } as Setting,
    ])

    const dto = await getAdminBlogSettings()

    expect(dto.bundle).toBeNull()
    expect(dto.settings).toBeNull()
  })
})

describe('services/settings — updateBlogSettingsSection', () => {
  it('rejects an invalid section payload with ActionFailure(400)', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    await expect(updateBlogSettingsSection('general', { title: '' } as never, null)).rejects.toBeInstanceOf(
      ActionFailure,
    )
    expect(settingQueries.upsertSetting).not.toHaveBeenCalled()
  })

  it("writes the validated general payload to scope='blog.general' verbatim", async () => {
    // The mock has to react to the upsert so that the post-write
    // re-hydration sees the new value: the service writes through
    // `upsertSetting()`, then immediately calls
    // `findSettingsByScopePrefix()` to refresh the snapshot. Without
    // this projection the hydrate would return the *old* fixture and
    // the legacy aggregated wrapper would echo the stale title.
    let currentRows = bundleRows(fixtureBundle)
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockImplementation(async () => currentRows)
    vi.mocked(settingQueries.upsertSetting).mockImplementation(async (data, updatedBy, scope) => {
      currentRows = currentRows
        .filter((row) => row.scope !== scope)
        .concat([
          {
            id: 99n,
            scope,
            data: data as Record<string, unknown>,
            updatedAt: new Date(),
            updatedBy,
          } as Setting,
        ])
      return undefined as never
    })

    const next = await updateBlogSettingsSection(
      'general',
      {
        title: '雨帆',
        description: 'desc',
        website: 'https://example.com',
        keywords: ['x'],
        author: { name: 'Yufan', email: 'a@b.co', url: 'https://example.com' },
      },
      42n,
    )

    expect(settingQueries.upsertSetting).toHaveBeenCalledOnce()
    const [data, updatedBy, scope] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    expect(scope).toBe('blog.general')
    expect((data as Record<string, unknown>).title).toBe('雨帆')
    // The row contents are the validated payload verbatim — no legacy
    // `settings` nesting.
    expect((data as Record<string, unknown>).settings).toBeUndefined()
    expect(updatedBy).toBe(42n)
    expect(next?.title).toBe('雨帆')
  })

  it("writes the localization patch to scope='blog.localization' only", async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue(bundleRows(fixtureBundle))
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await updateBlogSettingsSection(
      'localization',
      {
        asset: { host: 'cdn.test.example', scheme: 'https' },
        locale: 'en-US',
        timeZone: 'America/Los_Angeles',
        timeFormat: 'yyyy-MM-dd',
      },
      null,
    )

    const [data, , scope] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    expect(scope).toBe('blog.localization')
    const payload = data as Record<string, unknown>
    expect(payload.asset).toEqual({ host: 'cdn.test.example', scheme: 'https' })
    expect(payload.locale).toBe('en-US')
    expect(payload.timeZone).toBe('America/Los_Angeles')
    expect(payload.timeFormat).toBe('yyyy-MM-dd')
  })

  it('does not read the rest of the document when patching a single section (write isolation)', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue(bundleRows(fixtureBundle))
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await updateBlogSettingsSection('navigation', { navigation: [{ text: 'Home', link: '/' }] }, null)

    // The non-mail path never queries the existing row — the bug the
    // refactor fixed (`SELECT ... merge ... UPSERT` racing concurrent
    // edits) is no longer reachable.
    expect(settingQueries.findSettingByScope).not.toHaveBeenCalled()

    const [data, , scope] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    expect(scope).toBe('blog.navigation')
    expect((data as Record<string, unknown>).navigation).toEqual([{ text: 'Home', link: '/' }])
  })
})

describe('services/settings — mail section', () => {
  it("writes the full mail patch to scope='blog.mail' when an apiKey is provided", async () => {
    // The non-omitted-apiKey path doesn't read the existing row.
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue(bundleRows(fixtureBundle))
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await updateBlogSettingsSection(
      'mail',
      {
        mail: { enabled: true, host: 'api.zeabur.com', apiKey: 'NEWKEY', sender: 'noreply@example.com' },
      },
      null,
    )

    const [data, , scope] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    expect(scope).toBe('blog.mail')
    const mail = (data as Record<string, unknown>).mail as Record<string, unknown>
    expect(mail).toEqual({
      enabled: true,
      host: 'api.zeabur.com',
      apiKey: 'NEWKEY',
      sender: 'noreply@example.com',
    })
    // The mail-section's "preserve existing apiKey" branch is the only
    // one that reads back; supplying an explicit key skips it.
    expect(settingQueries.findSettingByScope).not.toHaveBeenCalled()
  })

  it("preserves the existing apiKey by reading scope='blog.mail' when omitted", async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValueOnce({
      id: 1n,
      scope: 'blog.mail',
      data: { mail: { enabled: true, host: 'old.example.com', apiKey: 'STORED', sender: 'a@b.co' } },
      updatedAt: new Date(),
      updatedBy: null,
    } as Setting)
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue(bundleRows(fixtureBundle))
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await updateBlogSettingsSection(
      'mail',
      {
        mail: { enabled: true, host: 'api.zeabur.com', sender: 'noreply@example.com' },
      },
      null,
    )

    // The keep-existing branch fetches ONLY the mail row; no other
    // section's row is touched.
    expect(settingQueries.findSettingByScope).toHaveBeenCalledExactlyOnceWith('blog.mail')
    const [data] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    const mail = (data as Record<string, unknown>).mail as Record<string, unknown>
    expect(mail.apiKey).toBe('STORED')
    expect(mail.host).toBe('api.zeabur.com')
    expect(mail.sender).toBe('noreply@example.com')
    expect(mail.enabled).toBe(true)
  })

  it('rejects a sender that is not a valid email', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    await expect(
      updateBlogSettingsSection(
        'mail',
        { mail: { enabled: false, host: 'api.zeabur.com', apiKey: '', sender: 'not-an-email' } },
        null,
      ),
    ).rejects.toBeInstanceOf(ActionFailure)
    expect(settingQueries.upsertSetting).not.toHaveBeenCalled()
  })
})

describe('services/settings — cache section', () => {
  it("writes a valid cache patch to scope='blog.cache' and refreshes the snapshot", async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue(bundleRows(fixtureBundle))
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await updateBlogSettingsSection(
      'cache',
      {
        cache: {
          og: { prefix: 'opengraph-', ttlSeconds: 60 * 60 * 24 * 14 },
          calendar: { prefix: 'cal:', ttlSeconds: 60 * 60 * 12 },
          avatar: { prefix: 'gravatar-', ttlSeconds: 60 * 60 * 24 * 3 },
        },
      },
      null,
    )

    const [data, , scope] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    expect(scope).toBe('blog.cache')
    const cache = (data as Record<string, unknown>).cache as Record<string, unknown>
    expect((cache.og as Record<string, unknown>).prefix).toBe('opengraph-')
    expect((cache.calendar as Record<string, unknown>).prefix).toBe('cal:')
    expect((cache.avatar as Record<string, unknown>).prefix).toBe('gravatar-')
  })

  it('rejects two buckets sharing the same prefix', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    await expect(
      updateBlogSettingsSection(
        'cache',
        {
          cache: {
            og: { prefix: 'shared-', ttlSeconds: 60 * 60 },
            calendar: { prefix: 'shared-', ttlSeconds: 60 * 60 },
            avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 },
          },
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ActionFailure)
    expect(settingQueries.upsertSetting).not.toHaveBeenCalled()
  })

  it('rejects a bucket whose prefix is a strict prefix of another', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    await expect(
      updateBlogSettingsSection(
        'cache',
        {
          cache: {
            og: { prefix: 'og-', ttlSeconds: 60 * 60 },
            calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 },
            avatar: { prefix: 'og-foo-', ttlSeconds: 60 * 60 },
          },
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ActionFailure)
    expect(settingQueries.upsertSetting).not.toHaveBeenCalled()
  })

  it('rejects a prefix that collides with the reserved session: surface', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    await expect(
      updateBlogSettingsSection(
        'cache',
        {
          cache: {
            og: { prefix: 'session:', ttlSeconds: 60 * 60 },
            calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 },
            avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 },
          },
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ActionFailure)
  })

  it('rejects a prefix that collides with the reserved rate-limit: surface', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    await expect(
      updateBlogSettingsSection(
        'cache',
        {
          cache: {
            og: { prefix: 'rate-', ttlSeconds: 60 * 60 },
            calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 },
            avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 },
          },
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ActionFailure)
  })

  it('rejects a prefix that does not end with `-` or `:`', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    await expect(
      updateBlogSettingsSection(
        'cache',
        {
          cache: {
            og: { prefix: 'ogkey', ttlSeconds: 60 * 60 },
            calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 },
            avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 },
          },
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ActionFailure)
  })

  it('rejects TTL below 1 hour or above 30 days', async () => {
    vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])

    await expect(
      updateBlogSettingsSection(
        'cache',
        {
          cache: {
            og: { prefix: 'og-', ttlSeconds: 60 },
            calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 },
            avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 },
          },
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ActionFailure)

    await expect(
      updateBlogSettingsSection(
        'cache',
        {
          cache: {
            og: { prefix: 'og-', ttlSeconds: 60 * 60 },
            calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 },
            avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 * 24 * 365 },
          },
        },
        null,
      ),
    ).rejects.toBeInstanceOf(ActionFailure)
  })
})

describe('services/settings — snapshot reader', () => {
  it('getBlogConfigSync returns null when the slot is empty (pre-install)', () => {
    setBlogSettingsBundleForTests(undefined)
    expect(getBlogConfigSync()).toBeNull()
  })

  it('getBlogConfigSync returns the legacy projection of the hydrated bundle', () => {
    const overridden: BlogSettings = { ...fixture, title: 'snapshot title' }
    setBlogSettingsBundleForTests(blogSettingsToBundle(overridden))

    const live = getBlogConfigSync()
    expect(live).not.toBeNull()
    expect(live?.title).toBe('snapshot title')
    expect(live?.settings.asset.host).toBe('cdn.example.com')
    expect(live?.settings.locale).toBe('zh-CN')
  })
})
