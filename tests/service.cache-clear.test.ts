import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// Tests that the inline cache clearing in posts/pages services works
// correctly, replacing the old `subscribeCatalogInvalidate` pattern.

const txMocks = vi.hoisted(() => {
  const insertReturning = vi.fn<() => unknown[]>(() => [])
  const insertValues = vi.fn(() => ({ returning: insertReturning }))
  const insert = vi.fn(() => ({ values: insertValues }))

  const updateReturning = vi.fn<() => unknown[]>(() => [])
  const updateWhere = vi.fn(() => ({ returning: updateReturning }))
  const updateSet = vi.fn(() => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set: updateSet }))

  return {
    insert,
    insertValues,
    insertReturning,
    update,
    updateSet,
    updateWhere,
    updateReturning,
  }
})

vi.mock('@/server/infra/db/pool', () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        insert: txMocks.insert,
        update: txMocks.update,
      }),
    ),
  },
}))

vi.mock('@/server/domains/posts/repo', () => ({
  countPostMetas: vi.fn(async () => 0),
  findContentById: vi.fn(),
  findContentsByIds: vi.fn(async () => []),
  findLatestDraft: vi.fn(),
  findLatestRevision: vi.fn(),
  findPostMetaById: vi.fn(),
  findPostMetaBySlug: vi.fn(),
  findPublicPostMetaBySlug: vi.fn(),
  listPostMetas: vi.fn(async () => []),
  listPublicPostMetas: vi.fn(async () => []),
  listRevisions: vi.fn(async () => []),
  publishLatestRevision: vi.fn(async () => ({ revisionId: 1n, changed: true })),
  restorePostMeta: vi.fn(async () => true),
  saveDraftRevision: vi.fn(async () => ({ id: 1n })),
  softDeletePostMeta: vi.fn(async () => true),
  updatePostMetaById: vi.fn(async () => null),
}))

function makeMockPostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    slug: 'new-post',
    title: 'New Post',
    summary: '',
    cover: '',
    og: null,
    published: false,
    commentsEnabled: true,
    showToc: false,
    showUpdated: false,
    visible: true,
    publishedAt: new Date(),
    publishedRevisionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    category: null,
    tags: [],
    alias: [],
    authorId: null,
    pinnedAt: null,
    firstPublishedAt: null,
    ...overrides,
  }
}

function makeMockPageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    slug: 'new-page',
    title: 'New Page',
    summary: '',
    cover: '',
    og: null,
    published: false,
    commentsEnabled: true,
    showToc: false,
    showUpdated: false,
    showFriends: false,
    publishedAt: new Date(),
    publishedRevisionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    authorId: null,
    permalink: '/new-page',
    ...overrides,
  }
}

vi.mock('@/server/domains/pages/repo', () => ({
  countPageMetas: vi.fn(async () => 0),
  findContentById: vi.fn(),
  findContentsByIds: vi.fn(async () => []),
  findLatestDraft: vi.fn(),
  findLatestRevision: vi.fn(),
  findPageMetaById: vi.fn(),
  findPageMetaBySlug: vi.fn(async () => null),
  findPublicPageMetaBySlug: vi.fn(),
  insertPageMeta: vi.fn(async () => makeMockPageRow()),
  listPageMetas: vi.fn(async () => []),
  listPublicPageMetas: vi.fn(async () => []),
  listRevisions: vi.fn(async () => []),
  publishLatestRevision: vi.fn(async () => ({ revisionId: 1n, changed: true })),
  restorePageMeta: vi.fn(async () => true),
  saveDraftRevision: vi.fn(async () => ({ id: 1n })),
  softDeletePageMeta: vi.fn(async () => true),
  updatePageMetaById: vi.fn(async () => null),
}))

vi.mock('@/server/domains/posts/indexer', () => ({
  indexPost: vi.fn(),
  removePostIndex: vi.fn(),
}))

vi.mock('@/server/domains/pages/image-sync', () => ({
  syncLibraryImageBlocks: vi.fn(),
}))

vi.mock('@/server/infra/db/operations/tag', () => ({
  seedTagIfMissing: vi.fn(),
}))

vi.mock('@/server/infra/db/operations/metric', () => ({
  ensureMetricsBatch: vi.fn(),
  ensureMetric: vi.fn(),
}))

vi.mock('@/server/domains/settings/sections', () => ({
  SECTION_REGISTRY: {},
}))

vi.mock('@/server/infra/db/operations/like', () => ({
  commentCountsByOwnerIds: vi.fn(async () => []),
  metricsByOwnerIds: vi.fn(async () => []),
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('posts service cache clearing', () => {
  it('loadCatalogPostMetas returns cached data within TTL', async () => {
    const postRepo = await import('@/server/domains/posts/repo')
    vi.mocked(postRepo.listPublicPostMetas).mockImplementation(
      async () =>
        [
          {
            id: 1n,
            slug: 'hello',
            title: 'Hello',
            summary: '',
            cover: '',
            published: true,
            visible: true,
            publishedAt: new Date(),
            deletedAt: null,
            category: null,
            tags: [],
            alias: [],
            firstPublishedAt: new Date(),
            updatedAt: new Date(),
            createdAt: new Date(),
            commentsEnabled: true,
            showToc: true,
            showUpdated: false,
            publishedRevisionId: 1n,
            authorId: null,
            pinnedAt: null,
            og: null,
          },
        ] as any,
    )

    const { loadCatalogPostMetas } = await import('@/server/domains/posts/service')

    const first = await loadCatalogPostMetas()
    expect(first).toHaveLength(1)

    // Second call should use cache (no additional DB call within 10s TTL)
    const second = await loadCatalogPostMetas()
    expect(second).toHaveLength(1)
    expect(postRepo.listPublicPostMetas).toHaveBeenCalledTimes(1)
  })

  it('mutation clears cache so next load hits DB', async () => {
    const postRepo = await import('@/server/domains/posts/repo')
    vi.mocked(postRepo.listPublicPostMetas).mockImplementation(
      async () =>
        [
          {
            id: 1n,
            slug: 'hello',
            title: 'Hello',
            summary: '',
            cover: '',
            published: true,
            visible: true,
            publishedAt: new Date(),
            deletedAt: null,
            category: null,
            tags: [],
            alias: [],
            firstPublishedAt: new Date(),
            updatedAt: new Date(),
            createdAt: new Date(),
            commentsEnabled: true,
            showToc: true,
            showUpdated: false,
            publishedRevisionId: 1n,
            authorId: null,
            pinnedAt: null,
            og: null,
          },
        ] as any,
    )
    vi.mocked(postRepo.findPostMetaBySlug).mockImplementation(async () => null)
    txMocks.insertReturning.mockReturnValue([makeMockPostRow()])
    txMocks.updateReturning.mockReturnValue([makeMockPostRow()])

    const { loadCatalogPostMetas, createPost } = await import('@/server/domains/posts/service')

    // Prime cache
    await loadCatalogPostMetas()
    expect(postRepo.listPublicPostMetas).toHaveBeenCalledTimes(1)

    // Mutate
    await createPost({ title: 'New Post', summary: '', tags: [], category: undefined }, null)

    // Next load should hit DB again (cache was cleared)
    await loadCatalogPostMetas()
    expect(postRepo.listPublicPostMetas).toHaveBeenCalledTimes(2)
  })

  it('multiple mutations in sequence clear cache each time', async () => {
    const postRepo = await import('@/server/domains/posts/repo')
    vi.mocked(postRepo.listPublicPostMetas).mockImplementation(
      async () =>
        [
          {
            id: 1n,
            slug: 'hello',
            title: 'Hello',
            summary: '',
            cover: '',
            published: true,
            visible: true,
            publishedAt: new Date(),
            deletedAt: null,
            category: null,
            tags: [],
            alias: [],
            firstPublishedAt: new Date(),
            updatedAt: new Date(),
            createdAt: new Date(),
            commentsEnabled: true,
            showToc: true,
            showUpdated: false,
            publishedRevisionId: 1n,
            authorId: null,
            pinnedAt: null,
            og: null,
          },
        ] as any,
    )
    vi.mocked(postRepo.findPostMetaBySlug).mockImplementation(async () => null)
    txMocks.insertReturning.mockReturnValue([makeMockPostRow()])

    const { loadCatalogPostMetas, createPost } = await import('@/server/domains/posts/service')

    await loadCatalogPostMetas()
    expect(postRepo.listPublicPostMetas).toHaveBeenCalledTimes(1)

    await createPost({ title: 'First', summary: '', tags: [], category: undefined }, null)
    await loadCatalogPostMetas()
    expect(postRepo.listPublicPostMetas).toHaveBeenCalledTimes(2)

    await createPost({ title: 'Second', summary: '', tags: [], category: undefined }, null)
    await loadCatalogPostMetas()
    expect(postRepo.listPublicPostMetas).toHaveBeenCalledTimes(3)
  })
})

describe('pages service cache clearing', () => {
  it('loadCatalogPages returns cached data within TTL', async () => {
    const pageRepo = await import('@/server/domains/pages/repo')
    vi.mocked(pageRepo.listPublicPageMetas).mockImplementation(
      async () =>
        [
          {
            id: 1n,
            slug: 'about',
            title: 'About',
            summary: '',
            cover: '',
            published: true,
            commentsEnabled: false,
            showToc: false,
            showUpdated: false,
            showFriends: false,
            og: null,
            publishedAt: new Date(),
            deletedAt: null,
            firstPublishedAt: new Date(),
            updatedAt: new Date(),
            createdAt: new Date(),
            publishedRevisionId: 1n,
            authorId: null,
          },
        ] as any,
    )

    const { loadCatalogPages } = await import('@/server/domains/pages/service')

    const first = await loadCatalogPages()
    expect(first).toHaveLength(1)

    const second = await loadCatalogPages()
    expect(second).toHaveLength(1)
    expect(pageRepo.listPublicPageMetas).toHaveBeenCalledTimes(1)
  })

  it('mutation clears cache so next load hits DB', async () => {
    const pageRepo = await import('@/server/domains/pages/repo')
    vi.mocked(pageRepo.listPublicPageMetas).mockImplementation(
      async () =>
        [
          {
            id: 1n,
            slug: 'about',
            title: 'About',
            summary: '',
            cover: '',
            published: true,
            commentsEnabled: false,
            showToc: false,
            showUpdated: false,
            showFriends: false,
            og: null,
            publishedAt: new Date(),
            deletedAt: null,
            firstPublishedAt: new Date(),
            updatedAt: new Date(),
            createdAt: new Date(),
            publishedRevisionId: 1n,
            authorId: null,
          },
        ] as any,
    )
    txMocks.insertReturning.mockReturnValue([makeMockPageRow()])
    txMocks.updateReturning.mockReturnValue([makeMockPageRow()])

    const { loadCatalogPages, createPage } = await import('@/server/domains/pages/service')

    // Prime cache
    await loadCatalogPages()
    expect(pageRepo.listPublicPageMetas).toHaveBeenCalledTimes(1)

    // Mutate
    await createPage({ title: 'New Page', summary: '', slug: 'new-page' }, null)

    // Next load should hit DB again
    await loadCatalogPages()
    expect(pageRepo.listPublicPageMetas).toHaveBeenCalledTimes(2)
  })
})
