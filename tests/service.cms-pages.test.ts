import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ContentRow, PageMetaRow } from '@/server/db/types'

// CMS page service — drives the save/publish state machine through
// the repository's mocked transactional helpers. The repository
// itself is mocked to keep this test layer focused on:
//   1. ActionFailure surfacing (slug validation, missing rows),
//   2. body validation through the PortableText perimeter,
//   3. DTO projection (CmsPage, AdminPageDto, AdminRevisionDto),
//   4. conflict-vs-saved branching translated to the wire shape.

vi.mock('@/server/cms/pages/repository', () => ({
  countPageMetas: vi.fn(async () => 0),
  findContentById: vi.fn(),
  findLatestDraft: vi.fn(),
  findLatestRevision: vi.fn(),
  findPageMetaById: vi.fn(),
  findPageMetaBySlug: vi.fn(),
  findPublicPageMetaBySlug: vi.fn(),
  insertPageMeta: vi.fn(),
  listPageMetas: vi.fn(async () => []),
  listPublicPageMetas: vi.fn(async () => []),
  listRevisions: vi.fn(async () => []),
  publishLatestRevision: vi.fn(),
  restorePageMeta: vi.fn(),
  saveDraftRevision: vi.fn(),
  softDeletePageMeta: vi.fn(),
  updatePageMetaById: vi.fn(),
}))

const repo = await import('@/server/cms/pages/repository')
const { ActionFailure } = await import('@/server/route-helpers/api-handler')
const service = await import('@/server/cms/pages/service')

function metaRow(overrides: Partial<PageMetaRow> = {}): PageMetaRow {
  const now = overrides.createdAt ?? new Date('2026-05-01T00:00:00.000Z')
  return {
    id: overrides.id ?? 1n,
    slug: overrides.slug ?? 'about',
    title: overrides.title ?? '关于我',
    summary: overrides.summary ?? '',
    cover: overrides.cover ?? '',
    og: overrides.og ?? null,
    published: overrides.published ?? true,
    commentsEnabled: overrides.commentsEnabled ?? true,
    showToc: overrides.showToc ?? false,
    publishedAt: overrides.publishedAt ?? now,
    publishedRevisionId: overrides.publishedRevisionId ?? null,
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
    deletedAt: overrides.deletedAt ?? null,
  }
}

function contentRow(overrides: Partial<ContentRow> = {}): ContentRow {
  const now = overrides.createdAt ?? new Date('2026-05-01T00:00:00.000Z')
  return {
    id: overrides.id ?? 100n,
    type: overrides.type ?? 'page',
    ownerId: overrides.ownerId ?? 1n,
    revisionNo: overrides.revisionNo ?? 1,
    status: overrides.status ?? 'draft',
    body: overrides.body ?? [],
    imageSources: overrides.imageSources ?? [],
    headings: overrides.headings ?? [],
    authorId: overrides.authorId ?? null,
    clientRevisionToken: overrides.clientRevisionToken ?? '00000000-0000-0000-0000-000000000001',
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

const VALID_BODY = [
  {
    _type: 'block',
    _key: 'b1',
    style: 'h2',
    children: [{ _type: 'span', _key: 's1', text: 'Hello world' }],
  },
]

beforeEach(() => {
  for (const fn of Object.values(repo)) {
    if (typeof fn === 'function' && 'mockReset' in fn) {
      ;(fn as ReturnType<typeof vi.fn>).mockReset()
    }
  }
})

describe('cms/pages/service — listPagesForAdmin / getPageDetailForAdmin', () => {
  it('hasMore = true while another page exists, false when the offset+rows reaches total', async () => {
    vi.mocked(repo.listPageMetas).mockResolvedValue([metaRow({ id: 1n }), metaRow({ id: 2n, slug: 'links' })])
    vi.mocked(repo.countPageMetas).mockResolvedValue(5)

    const more = await service.listPagesForAdmin({ offset: 0, limit: 2 })
    expect(more.total).toBe(5)
    expect(more.hasMore).toBe(true)
    expect(more.pages.map((p) => p.slug)).toEqual(['about', 'links'])

    vi.mocked(repo.listPageMetas).mockResolvedValue([metaRow({ id: 5n, slug: 'guestbook' })])
    vi.mocked(repo.countPageMetas).mockResolvedValue(5)
    const last = await service.listPagesForAdmin({ offset: 4, limit: 2 })
    expect(last.hasMore).toBe(false)
  })

  it('getPageDetailForAdmin returns null for missing rows (route then 404s)', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(null)
    expect(await service.getPageDetailForAdmin(99n)).toBeNull()
  })

  it('getPageDetailForAdmin projects latest + published revisions independently', async () => {
    const meta = metaRow({ id: 7n, publishedRevisionId: 200n })
    const draft = contentRow({ id: 201n, ownerId: 7n, revisionNo: 4, status: 'draft' })
    const published = contentRow({ id: 200n, ownerId: 7n, revisionNo: 3, status: 'published' })
    vi.mocked(repo.findPageMetaById).mockResolvedValue(meta)
    vi.mocked(repo.findLatestRevision).mockResolvedValue(draft)
    vi.mocked(repo.findContentById).mockResolvedValue(published)

    const detail = await service.getPageDetailForAdmin(7n)
    expect(detail?.page.id).toBe('7')
    expect(detail?.latestRevision?.revisionNo).toBe(4)
    expect(detail?.latestRevision?.status).toBe('draft')
    expect(detail?.publishedRevision?.revisionNo).toBe(3)
    expect(detail?.publishedRevision?.status).toBe('published')
  })
})

describe('cms/pages/service — createPage / updatePageMeta validation', () => {
  it('rejects slugs that contain illegal characters', async () => {
    await expect(service.createPage({ slug: 'About Me', title: 'x' }, null)).rejects.toBeInstanceOf(ActionFailure)
  })

  it('rejects reserved slugs that would shadow public routes', async () => {
    for (const slug of ['posts', 'cats', 'tags', 'wp-admin', 'api']) {
      await expect(service.createPage({ slug, title: 't' }, null)).rejects.toBeInstanceOf(ActionFailure)
    }
  })

  it('rejects an existing slug on create with HTTP 409 semantics', async () => {
    vi.mocked(repo.findPageMetaBySlug).mockResolvedValue(metaRow({ slug: 'about' }))
    await expect(service.createPage({ slug: 'about', title: 't' }, null)).rejects.toMatchObject({ status: 409 })
  })

  it('updatePageMeta tolerates a same-slug edit (no collision check fires)', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(metaRow({ id: 7n, slug: 'about', title: 'old' }))
    vi.mocked(repo.updatePageMetaById).mockResolvedValue(metaRow({ id: 7n, slug: 'about', title: 'new' }))
    const dto = await service.updatePageMeta({ id: 7n, slug: 'about', title: 'new' })
    expect(dto.title).toBe('new')
    expect(repo.findPageMetaBySlug).not.toHaveBeenCalled()
  })

  it('updatePageMeta blocks renaming to a slug already used by a different page', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(metaRow({ id: 7n, slug: 'about' }))
    vi.mocked(repo.findPageMetaBySlug).mockResolvedValue(metaRow({ id: 99n, slug: 'guestbook' }))
    await expect(service.updatePageMeta({ id: 7n, slug: 'guestbook', title: 't' })).rejects.toMatchObject({
      status: 409,
    })
  })

  it('updatePageMeta returns 404 when the row was already deleted', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(null)
    await expect(service.updatePageMeta({ id: 7n, slug: 'about', title: 't' })).rejects.toMatchObject({ status: 404 })
  })
})

describe('cms/pages/service — saveDraft / publishLatest body validation', () => {
  it('rejects a malformed body (zod issues become ActionFailure 400)', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(metaRow({ id: 1n }))
    await expect(
      service.saveDraft({ pageId: 1n, body: [{ _type: 'unknown', _key: 'k' }], authorId: null }),
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.saveDraftRevision).not.toHaveBeenCalled()
  })

  it('rejects when the page row is missing without touching the transaction', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(null)
    await expect(service.saveDraft({ pageId: 1n, body: VALID_BODY, authorId: null })).rejects.toMatchObject({
      status: 404,
    })
    expect(repo.saveDraftRevision).not.toHaveBeenCalled()
  })

  it('forwards body, derived imageSources, and derived headings into the repository call', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(metaRow({ id: 1n }))
    vi.mocked(repo.saveDraftRevision).mockResolvedValue({
      status: 'saved',
      row: contentRow({ revisionNo: 1, status: 'draft' }),
    })

    const body = [
      { _type: 'block', _key: 'h1', style: 'h2', children: [{ _type: 'span', _key: 's1', text: 'Hello' }] },
      {
        _type: 'image',
        _key: 'i1',
        src: 'https://cdn/example.jpg',
        storagePath: 'images/2026/05/foo.jpg',
      },
    ]
    await service.saveDraft({ pageId: 1n, body, authorId: 42n })

    const arg = vi.mocked(repo.saveDraftRevision).mock.calls[0][0]
    expect(arg.ownerId).toBe(1n)
    expect(arg.imageSources).toEqual(['images/2026/05/foo.jpg'])
    expect(arg.headings).toEqual([{ depth: 2, text: 'Hello', slug: 'hello' }])
    expect(arg.authorId).toBe(42n)
  })

  it('translates a repository "conflict" into the wire shape with the latest revision DTO', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(metaRow({ id: 1n }))
    const latest = contentRow({
      id: 999n,
      revisionNo: 5,
      status: 'draft',
      clientRevisionToken: '11111111-2222-3333-4444-555555555555',
    })
    vi.mocked(repo.saveDraftRevision).mockResolvedValue({
      status: 'conflict',
      latest,
      expectedToken: latest.clientRevisionToken,
    })

    const result = await service.saveDraft({
      pageId: 1n,
      body: VALID_BODY,
      authorId: null,
      expectedClientRevisionToken: 'stale-token',
    })
    expect(result.status).toBe('conflict')
    if (result.status === 'conflict') {
      expect(result.latest.id).toBe('999')
      expect(result.latest.revisionNo).toBe(5)
      expect(result.expectedToken).toBe(latest.clientRevisionToken)
    }
  })

  it('publishLatest projects the saved revision back as a "saved" wire DTO', async () => {
    vi.mocked(repo.findPageMetaById).mockResolvedValue(metaRow({ id: 1n }))
    vi.mocked(repo.publishLatestRevision).mockResolvedValue({
      status: 'published',
      row: contentRow({ revisionNo: 7, status: 'published' }),
    })
    const result = await service.publishLatest({ pageId: 1n, body: VALID_BODY, authorId: 5n })
    expect(result.status).toBe('saved')
    if (result.status === 'saved') {
      expect(result.revision.status).toBe('published')
      expect(result.revision.revisionNo).toBe(7)
    }
  })
})

describe('cms/pages/service — public catalog projection', () => {
  it('loadCatalogPageBySlug 404s on soft-deleted rows', async () => {
    vi.mocked(repo.findPublicPageMetaBySlug).mockResolvedValue(null)
    expect(await service.loadCatalogPageBySlug('gone')).toBeNull()
  })

  it('loadCatalogPageBySlug 404s when meta.published=false', async () => {
    vi.mocked(repo.findPublicPageMetaBySlug).mockResolvedValue(metaRow({ published: false }))
    expect(await service.loadCatalogPageBySlug('about')).toBeNull()
  })

  it('loadCatalogPageBySlug emits an empty body when no revision has been published yet', async () => {
    vi.mocked(repo.findPublicPageMetaBySlug).mockResolvedValue(metaRow({ id: 1n, publishedRevisionId: null }))
    const page = await service.loadCatalogPageBySlug('about')
    expect(page?.body).toEqual([])
    expect(page?.headings).toEqual([])
    expect(page?.imageSources).toEqual([])
    expect(repo.findContentById).not.toHaveBeenCalled()
  })

  it('loadCatalogPageBySlug joins the published revision body when present', async () => {
    vi.mocked(repo.findPublicPageMetaBySlug).mockResolvedValue(metaRow({ id: 1n, publishedRevisionId: 200n }))
    vi.mocked(repo.findContentById).mockResolvedValue(
      contentRow({
        id: 200n,
        revisionNo: 3,
        status: 'published',
        body: VALID_BODY,
        imageSources: ['images/2026/05/foo.jpg'],
        headings: [{ depth: 2, text: 'Hello', slug: 'hello' }],
      }),
    )
    const page = await service.loadCatalogPageBySlug('about')
    expect(page?.body).toEqual(VALID_BODY)
    expect(page?.imageSources).toEqual(['images/2026/05/foo.jpg'])
    expect(page?.headings).toEqual([{ depth: 2, text: 'Hello', slug: 'hello' }])
    expect(page?.publishedRevisionId).toBe(200n)
  })
})
