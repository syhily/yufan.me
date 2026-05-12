import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Setting } from '@/server/db/types'

vi.mock('@/server/db/query/setting', () => ({
  findSettingByScope: vi.fn(),
  findSettingsByScopePrefix: vi.fn(),
  upsertSetting: vi.fn(),
}))

// Snapshot hydrate/refresh fan through `storage.getItem` /
// `storage.setItem` (the settings-version coherence key). The default
// `@/server/cache/storage` would try to dial `redis://localhost:6379` —
// fine locally, but on CI there is no Redis and `ioredis` retries
// forever, blowing past every test timeout. Tests only assert on
// `upsertSetting`, so an in-memory no-op is plenty.
vi.mock('@/server/cache/storage', () => ({
  storage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}))

const settingQueries = await import('@/server/db/query/setting')
const { updateBlogSettingsSection } = await import('@/server/settings/service')
const { setBlogSettingsBundleForTests } = await import('@/server/settings/snapshot')

// Per-section UPSERT isolation. Before the storage refactor every
// `updateBlogSettingsSection` call did a full-row SELECT → merge in
// memory → UPSERT the entire JSONB document. Two concurrent saves to
// different sections could read the same baseline and the slower
// writer would silently revert the faster writer's changes. The split
// makes that race UNREACHABLE because each section now owns its own
// row keyed on a distinct unique `scope`.
//
// The tests here drive the boundary the bug used to live behind: two
// awaited writes to different sections must produce two `upsertSetting`
// calls keyed on different scopes, with no cross-pollination of the
// payloads. We don't try to assert "concurrent writes don't lose data"
// at the SQL level — that's now PostgreSQL's job — but we do assert
// that the service layer never blends two section payloads into a
// single row.

beforeEach(() => {
  vi.mocked(settingQueries.findSettingByScope).mockReset()
  vi.mocked(settingQueries.findSettingsByScopePrefix).mockReset()
  vi.mocked(settingQueries.upsertSetting).mockReset()
  setBlogSettingsBundleForTests(undefined)
  // The post-update snapshot refresh re-queries the prefix; return an
  // empty bundle so it doesn't blow up. The assertions below only care
  // about what `upsertSetting` saw.
  vi.mocked(settingQueries.findSettingsByScopePrefix).mockResolvedValue([])
  vi.mocked(settingQueries.upsertSetting).mockResolvedValue({} as Setting)
})

describe('services/settings — write isolation', () => {
  it('parallel saves to mail and cache produce two scope-isolated UPSERTs', async () => {
    // mail with explicit apiKey skips the keep-existing branch, so no
    // `findSettingByScope` round-trip is needed.
    await Promise.all([
      updateBlogSettingsSection(
        'mail',
        { mail: { enabled: true, host: 'api.zeabur.com', apiKey: 'KEY-A', sender: 'a@example.com' } },
        null,
      ),
      updateBlogSettingsSection(
        'cache',
        {
          cache: {
            // The `:`-suffixed forms are the safe shape: `og-` (without
            // a colon) collides with the `og:` reserved prefix and
            // `avatar-` collides with the reserved `avatar-status-`.
            og: { prefix: 'og-bucket:', ttlSeconds: 60 * 60 * 24 },
            calendar: { prefix: 'cal-bucket:', ttlSeconds: 60 * 60 * 24 },
            avatar: { prefix: 'av-bucket:', ttlSeconds: 60 * 60 * 24 },
            imageMeta: { prefix: 'image-meta-bucket:', ttlSeconds: 60 * 60 * 24 },

            embeddingSearch: { prefix: 'embedding-search-bucket:', ttlSeconds: 60 * 60 * 24 },
            searchResult: { prefix: 'search-result-bucket:', ttlSeconds: 60 * 60 * 24 },
          },
        },
        null,
      ),
    ])

    expect(settingQueries.upsertSetting).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(settingQueries.upsertSetting).mock.calls
    const scopes = calls.map((call) => call[2])
    expect(new Set(scopes)).toEqual(new Set(['blog.mail', 'blog.cache']))

    // Each call only carried its own section's payload. The mail call
    // never embeds a `cache` key (and vice versa) — the legacy code
    // would have re-written the whole JSONB document each time.
    for (const [data, , scope] of calls) {
      const payload = data as Record<string, unknown>
      if (scope === 'blog.mail') {
        expect(payload.mail).toBeDefined()
        expect(payload.cache).toBeUndefined()
      } else {
        expect(payload.cache).toBeDefined()
        expect(payload.mail).toBeUndefined()
      }
    }
  })

  it('saving sidebar does not read or rewrite the mail row', async () => {
    await updateBlogSettingsSection(
      'sidebar',
      { sidebar: { calendar: false, search: true, comment: 5, post: 5, tag: 10 } },
      null,
    )

    // Only mail's keep-existing branch reaches for `findSettingByScope`.
    // Other sections write straight through, so a sidebar save MUST
    // NOT touch the mail row at all (otherwise a concurrent mail
    // edit could silently lose the API key).
    expect(settingQueries.findSettingByScope).not.toHaveBeenCalled()

    expect(settingQueries.upsertSetting).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ sidebar: expect.any(Object) }),
      null,
      'blog.sidebar',
    )
  })

  it('mail save with omitted apiKey reads ONLY the mail scope, not any other section', async () => {
    vi.mocked(settingQueries.findSettingByScope).mockResolvedValueOnce({
      id: 1n,
      scope: 'blog.mail',
      data: { mail: { enabled: true, host: 'old.example.com', apiKey: 'KEEP-ME', sender: 'a@b.co' } },
      updatedAt: new Date(),
      updatedBy: null,
    } as Setting)

    await updateBlogSettingsSection(
      'mail',
      { mail: { enabled: true, host: 'api.zeabur.com', sender: 'noreply@example.com' } },
      null,
    )

    // The keep-existing branch is exactly one read of `blog.mail` —
    // never of the bundled-row aggregate, never of any other section.
    expect(settingQueries.findSettingByScope).toHaveBeenCalledExactlyOnceWith('blog.mail')
    const [data, , scope] = vi.mocked(settingQueries.upsertSetting).mock.calls[0]
    expect(scope).toBe('blog.mail')
    const mail = (data as Record<string, unknown>).mail as Record<string, unknown>
    expect(mail.apiKey).toBe('KEEP-ME')
  })
})
