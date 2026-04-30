import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/server/db/query/setting', () => ({
  findSettingByScope: vi.fn(),
  upsertSetting: vi.fn(),
}))

const settingQueries = await import('@/server/db/query/setting')
const { DEFAULT_SETTINGS } = await import('@/server/settings/defaults')
const { getAdminBlogSettings, updateBlogSettingsSection, resetBlogSettingsSection } =
  await import('@/server/settings/service')
const { setBlogSettingsSnapshotForTests, getBlogConfigSync } = await import('@/server/settings/snapshot')
const { ActionFailure } = await import('@/server/route-helpers/api-handler')

beforeEach(() => {
  vi.mocked(settingQueries.findSettingByScope).mockReset()
  vi.mocked(settingQueries.upsertSetting).mockReset()
  setBlogSettingsSnapshotForTests(undefined)
})

describe('services/settings — getAdminBlogSettings', () => {
  it('returns the seed defaults when no DB row exists', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

    const dto = await getAdminBlogSettings()

    expect(dto.settings.title).toBe(DEFAULT_SETTINGS.title)
    expect(dto.settings.navigation).toEqual(DEFAULT_SETTINGS.navigation)
    // OG dimensions are now part of the editable slice (DB-backed).
    expect(dto.settings.settings.og).toEqual(DEFAULT_SETTINGS.settings.og)
    // Bucket-A constants are returned read-only alongside the editable slice.
    expect(dto.constants.asset).toBeDefined()
    expect(dto.constants.locale).toBeDefined()
  })

  it('merges the stored row over the defaults (per-key fallback)', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue({
      id: 1n,
      scope: 'blog',
      data: { title: '新标题', settings: { sidebar: { calendar: false } } },
      updatedAt: new Date(),
      updatedBy: null,
    } as never)

    const dto = await getAdminBlogSettings()

    expect(dto.settings.title).toBe('新标题')
    expect(dto.settings.description).toBe(DEFAULT_SETTINGS.description)
    expect(dto.settings.settings.sidebar.calendar).toBe(false)
    expect(dto.settings.settings.sidebar.search).toBe(DEFAULT_SETTINGS.settings.sidebar.search)
  })
})

describe('services/settings — updateBlogSettingsSection', () => {
  it('rejects an invalid section payload with ActionFailure(400)', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

    await expect(updateBlogSettingsSection('general', { title: '' } as never, null)).rejects.toBeInstanceOf(
      ActionFailure,
    )
    expect(settingQueries.upsertSetting).not.toHaveBeenCalled()
  })

  it('writes a section-scoped patch and refreshes the snapshot', async () => {
    // First call (during the update path): the row hasn't been touched yet.
    // Second call (the post-write refresh): returns the row with the new title.
    vi.mocked(settingQueries.findSettingByScope)
      .mockResolvedValueOnce({
        id: 1n,
        scope: 'blog',
        data: {},
        updatedAt: new Date(),
        updatedBy: null,
      } as never)
      .mockResolvedValueOnce({
        id: 1n,
        scope: 'blog',
        data: { title: '雨帆' },
        updatedAt: new Date(),
        updatedBy: 42n,
      } as never)
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

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
    const [data, updatedBy] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    expect((data as Record<string, unknown>).title).toBe('雨帆')
    expect(updatedBy).toBe(42n)
    // The returned snapshot reflects the just-written values (refreshed).
    expect(next.title).toBe('雨帆')
  })

  it('preserves existing data in other sections when patching one section', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue({
      id: 1n,
      scope: 'blog',
      data: { title: 'keep me', settings: { sidebar: { calendar: false, search: true } } },
      updatedAt: new Date(),
      updatedBy: null,
    } as never)
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await updateBlogSettingsSection('navigation', { navigation: [{ text: 'Home', link: '/' }] }, null)

    const [data] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    const next = data as Record<string, unknown>
    expect(next.title).toBe('keep me')
    expect((next.settings as Record<string, unknown>).sidebar).toEqual({ calendar: false, search: true })
    expect(next.navigation).toEqual([{ text: 'Home', link: '/' }])
  })
})

describe('services/settings — resetBlogSettingsSection', () => {
  it('drops the section keys so the next read falls back to DEFAULT_SETTINGS', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue({
      id: 1n,
      scope: 'blog',
      data: {
        title: 'override',
        description: 'override',
        navigation: [{ text: 'Custom', link: '/x' }],
        settings: { sidebar: { calendar: false, search: false } },
      },
      updatedAt: new Date(),
      updatedBy: null,
    } as never)
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await resetBlogSettingsSection('general', null)

    const [data] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    const next = data as Record<string, unknown>
    expect(next.title).toBeUndefined()
    expect(next.description).toBeUndefined()
    expect(next.navigation).toEqual([{ text: 'Custom', link: '/x' }])
  })

  it('removes only the targeted nested settings when resetting `sidebar`', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue({
      id: 1n,
      scope: 'blog',
      data: { settings: { sidebar: { calendar: false }, footer: { initialYear: 2020 } } },
      updatedAt: new Date(),
      updatedBy: null,
    } as never)
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await resetBlogSettingsSection('sidebar', null)

    const [data] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    const next = (data as Record<string, unknown>).settings as Record<string, unknown>
    expect(next.sidebar).toBeUndefined()
    expect(next.footer).toEqual({ initialYear: 2020 })
  })
})

describe('services/settings — mail section', () => {
  it('writes the full mail patch when an apiKey is provided', async () => {
    vi.mocked(settingQueries.findSettingByScope)
      .mockResolvedValueOnce({
        id: 1n,
        scope: 'blog',
        data: { settings: { mail: { enabled: false, host: 'old', apiKey: 'OLDKEY', sender: 'old@example.com' } } },
        updatedAt: new Date(),
        updatedBy: null,
      } as never)
      .mockResolvedValueOnce({ id: 1n, scope: 'blog', data: {}, updatedAt: new Date(), updatedBy: null } as never)
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    await updateBlogSettingsSection(
      'mail',
      {
        mail: { enabled: true, host: 'api.zeabur.com', apiKey: 'NEWKEY', sender: 'noreply@example.com' },
      },
      null,
    )

    const [data] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    const mail = ((data as Record<string, unknown>).settings as Record<string, unknown>).mail as Record<string, unknown>
    expect(mail).toEqual({
      enabled: true,
      host: 'api.zeabur.com',
      apiKey: 'NEWKEY',
      sender: 'noreply@example.com',
    })
  })

  it('preserves the existing apiKey when the patch omits it', async () => {
    vi.mocked(settingQueries.findSettingByScope)
      .mockResolvedValueOnce({
        id: 1n,
        scope: 'blog',
        data: {
          settings: { mail: { enabled: true, host: 'old.example.com', apiKey: 'STORED', sender: 'a@b.co' } },
        },
        updatedAt: new Date(),
        updatedBy: null,
      } as never)
      .mockResolvedValueOnce({ id: 1n, scope: 'blog', data: {}, updatedAt: new Date(), updatedBy: null } as never)
    vi.mocked(settingQueries.upsertSetting).mockResolvedValue(undefined as never)

    // Editor changed `host` and `sender` but left the API Key field empty
    // — the perimeter should preserve the existing key.
    await updateBlogSettingsSection(
      'mail',
      {
        mail: { enabled: true, host: 'api.zeabur.com', sender: 'noreply@example.com' },
      },
      null,
    )

    const [data] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    const mail = ((data as Record<string, unknown>).settings as Record<string, unknown>).mail as Record<string, unknown>
    expect(mail.apiKey).toBe('STORED')
    expect(mail.host).toBe('api.zeabur.com')
    expect(mail.sender).toBe('noreply@example.com')
    expect(mail.enabled).toBe(true)
  })

  it('rejects a sender that is not a valid email', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

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
  it('writes a valid cache patch and refreshes the snapshot', async () => {
    vi.mocked(settingQueries.findSettingByScope)
      .mockResolvedValueOnce({
        id: 1n,
        scope: 'blog',
        data: {},
        updatedAt: new Date(),
        updatedBy: null,
      } as never)
      .mockResolvedValueOnce({ id: 1n, scope: 'blog', data: {}, updatedAt: new Date(), updatedBy: null } as never)
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

    const [data] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    const cache = ((data as Record<string, unknown>).settings as Record<string, unknown>).cache as Record<
      string,
      unknown
    >
    expect((cache.og as Record<string, unknown>).prefix).toBe('opengraph-')
    expect((cache.calendar as Record<string, unknown>).prefix).toBe('cal:')
    expect((cache.avatar as Record<string, unknown>).prefix).toBe('gravatar-')
  })

  it('rejects two buckets sharing the same prefix', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

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
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

    // `og-` is a strict prefix of `og-foo-`; SCAN `og-*` would match
    // both buckets and clearing OG would also clear avatar.
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
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

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
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

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
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

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
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValue(undefined as never)

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

describe('services/settings — snapshot proxy', () => {
  it('getBlogConfigSync returns the merged config including bucket-A constants', () => {
    setBlogSettingsSnapshotForTests({
      ...DEFAULT_SETTINGS,
      title: 'snapshot title',
    })

    const live = getBlogConfigSync()
    expect(live.title).toBe('snapshot title')
    // Bucket-A field still comes from blog.config.ts.
    expect(live.settings.asset).toBeDefined()
    expect(live.settings.locale).toBeDefined()
  })
})
