import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  getBlogSettingsBundleSync: vi.fn(),
  generateEmbedding: vi.fn(),
}))

vi.mock('@/server/infra/db/pool', () => ({
  db: { select: mocks.dbSelect },
}))

vi.mock('@/shared/config/blog', () => ({
  getBlogSettingsBundleSync: mocks.getBlogSettingsBundleSync,
}))

vi.mock('@/server/infra/search/openai', () => ({
  generateEmbedding: mocks.generateEmbedding,
}))

// `searchPosts` caches result slugs in Redis. The default
// `@/server/cache/storage` would try to dial `redis://localhost:6379` —
// fine locally, but on CI there is no Redis and `ioredis` retries
// forever, blowing past every test timeout. An in-memory no-op forces
// every call to a cache miss so tests exercise the real query path.
vi.mock('@/server/infra/cache/storage', () => ({
  storage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}))

function chainable(rows: unknown[]) {
  const handle = Promise.resolve(rows) as unknown as {
    from: () => typeof handle
    innerJoin: () => typeof handle
    leftJoin: () => typeof handle
    where: () => typeof handle
    orderBy: () => typeof handle
    limit: () => typeof handle
    then: Promise<unknown[]>['then']
  }
  handle.from = () => handle
  handle.innerJoin = () => handle
  handle.leftJoin = () => handle
  handle.where = () => handle
  handle.orderBy = () => handle
  handle.limit = () => handle
  return handle
}

const { searchPostOptions, searchPosts } = await import('@/server/infra/search')

beforeEach(() => {
  mocks.dbSelect.mockReset()
  mocks.getBlogSettingsBundleSync.mockReset()
  mocks.generateEmbedding.mockReset()

  // Default: LIKE mode (no vector)
  mocks.getBlogSettingsBundleSync.mockReturnValue({
    search: {
      search: {
        enabled: false,
        mode: 'like',
        endpoint: '',
        apiKey: '',
        model: 'text-embedding-3-small',
        similarityThreshold: 0.5,
      },
    },
  })
})

describe('services/search — searchPosts', () => {
  it('returns empty results for empty query', async () => {
    const result = await searchPosts('', 10)
    expect(result.hits).toEqual([])
    expect(result.totalPages).toBe(0)
  })

  it('uses LIKE mode by default', async () => {
    mocks.dbSelect.mockImplementation(() => chainable([{ slug: 'post-with-phrase' }, { slug: 'another-post' }]))

    const result = await searchPosts('向量数据库', 10)

    expect(result.hits).toEqual(['post-with-phrase', 'another-post'])
    expect(result.totalPages).toBe(1)
    expect(mocks.generateEmbedding).not.toHaveBeenCalled()
  })

  it('paginates LIKE results', async () => {
    mocks.dbSelect.mockImplementation(() => chainable([{ slug: 'post-a' }, { slug: 'post-b' }, { slug: 'post-c' }]))

    const result = await searchPosts('query', 2, 1)

    expect(result.hits).toEqual(['post-b', 'post-c'])
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(2)
  })

  it('uses vector mode when enabled and embedding succeeds', async () => {
    mocks.getBlogSettingsBundleSync.mockReturnValue({
      search: {
        search: {
          enabled: true,
          mode: 'vector',
          endpoint: '',
          apiKey: 'sk-test',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.5,
        },
      },
    })
    mocks.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3])
    mocks.dbSelect.mockImplementation(() => chainable([{ slug: 'vector-match-1' }, { slug: 'vector-match-2' }]))

    const result = await searchPosts('semantic query', 10)

    expect(mocks.generateEmbedding).toHaveBeenCalledWith('semantic query')
    expect(result.hits).toEqual(['vector-match-1', 'vector-match-2'])
  })

  it('falls back to LIKE when vector mode is enabled but embedding fails', async () => {
    mocks.getBlogSettingsBundleSync.mockReturnValue({
      search: {
        search: {
          enabled: true,
          mode: 'vector',
          endpoint: '',
          apiKey: 'sk-test',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.5,
        },
      },
    })
    mocks.generateEmbedding.mockResolvedValue(null)
    mocks.dbSelect.mockImplementation(() => chainable([{ slug: 'like-fallback' }]))

    const result = await searchPosts('query', 10)

    expect(mocks.generateEmbedding).toHaveBeenCalled()
    expect(result.hits).toEqual(['like-fallback'])
  })

  it('exposes searchPostOptions with correct visibility flags', () => {
    expect(searchPostOptions()).toEqual({
      includeHidden: true,
      includeScheduled: import.meta.env.DEV,
    })
  })
})
