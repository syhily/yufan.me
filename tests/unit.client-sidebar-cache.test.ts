import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// Hoist `vi.mock` calls before importing the module under test so
// `@/client/api/actions` resolves through the mocked path manifest. We
// keep a real-ish path so the cache module's URL key matches what a
// browser would see.
const SNAPSHOT_PATH = '/api/actions/sidebar/snapshot'
vi.mock('@/client/api/actions', () => ({
  API_ACTIONS: {
    sidebar: {
      snapshot: { route: 'api/actions/sidebar/snapshot', path: SNAPSHOT_PATH, method: 'GET' as const },
    },
  },
}))

const { getSidebarSnapshot, invalidateSidebarSnapshot, writeSidebarSnapshotCache } =
  await import('@/client/sidebar/cache')

interface MockResponseInit {
  status?: number
}

function makeResponse(body: unknown, init: MockResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Minimal CacheStorage / Cache shim. Only models the methods the module
// actually invokes (`open`, `match`, `put`, `delete`).
function makeMockCacheStorage() {
  const store = new Map<string, Response>()
  const cache: Cache = {
    add: vi.fn(),
    addAll: vi.fn(),
    delete: vi.fn(async (req: RequestInfo) => {
      return store.delete(typeof req === 'string' ? req : req.url)
    }) as Cache['delete'],
    keys: vi.fn(),
    match: vi.fn(async (req: RequestInfo) => {
      const url = typeof req === 'string' ? req : req.url
      const cached = store.get(url)
      // Return a clone so consumers can `.json()` it safely (a Response
      // body can only be consumed once).
      return cached?.clone()
    }) as Cache['match'],
    matchAll: vi.fn(),
    put: vi.fn(async (req: RequestInfo, response: Response) => {
      const url = typeof req === 'string' ? req : req.url
      store.set(url, response.clone())
    }) as Cache['put'],
  } as unknown as Cache
  const storage: CacheStorage = {
    open: vi.fn(async () => cache),
    match: vi.fn(),
    has: vi.fn(),
    keys: vi.fn(),
    delete: vi.fn(),
  }
  return { storage, cache, store }
}

describe('client/sidebar/cache', () => {
  let originalCaches: CacheStorage | undefined
  let originalFetch: typeof fetch | undefined
  let mockCaches: ReturnType<typeof makeMockCacheStorage>

  beforeEach(async () => {
    mockCaches = makeMockCacheStorage()
    originalCaches = globalThis.caches as CacheStorage | undefined
    originalFetch = globalThis.fetch
    Object.defineProperty(globalThis, 'caches', {
      value: mockCaches.storage,
      configurable: true,
      writable: true,
    })
    // Always start with an empty cache so order-of-execution tests don't
    // see stale state across iterations.
    await invalidateSidebarSnapshot()
  })

  afterEach(() => {
    if (originalCaches === undefined) {
      delete (globalThis as { caches?: CacheStorage }).caches
    } else {
      Object.defineProperty(globalThis, 'caches', {
        value: originalCaches,
        configurable: true,
        writable: true,
      })
    }
    if (originalFetch !== undefined) {
      globalThis.fetch = originalFetch
    }
    vi.restoreAllMocks()
  })

  it('hits the network on a cold cache and stores the result', async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse({
        data: { admin: false, recentComments: [], pendingComments: [] },
      }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await getSidebarSnapshot()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(SNAPSHOT_PATH, expect.objectContaining({ method: 'GET' }))
    expect(result).toEqual({ admin: false, recentComments: [], pendingComments: [] })
    // Subsequent fresh-cache reads must not touch the network.
    fetchMock.mockClear()
    const second = await getSidebarSnapshot()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(second).toEqual(result)
  })

  it('writeSidebarSnapshotCache primes the cache so the next read avoids the network', async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse({ data: { admin: true, recentComments: [], pendingComments: [] } }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await writeSidebarSnapshotCache({ admin: true, recentComments: [], pendingComments: [] })
    const result = await getSidebarSnapshot()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual({ admin: true, recentComments: [], pendingComments: [] })
  })

  it('throws when the JSON envelope reports an error', async () => {
    const fetchMock = vi.fn(async () => makeResponse({ error: { message: 'Sidebar dead' } }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(getSidebarSnapshot()).rejects.toThrow('Sidebar dead')
  })

  it('throws on non-2xx responses', async () => {
    const fetchMock = vi.fn(async () => makeResponse({ error: { message: 'unused' } }, { status: 500 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(getSidebarSnapshot()).rejects.toThrow('HTTP 500')
  })

  it('invalidateSidebarSnapshot evicts the cached entry', async () => {
    await writeSidebarSnapshotCache({ admin: true, recentComments: [], pendingComments: [] })
    await invalidateSidebarSnapshot()
    const fetchMock = vi.fn(async () =>
      makeResponse({ data: { admin: false, recentComments: [], pendingComments: [] } }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await getSidebarSnapshot()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.admin).toBe(false)
  })

  it('bypassCache forces a network round-trip even with a fresh cache hit', async () => {
    await writeSidebarSnapshotCache({ admin: true, recentComments: [], pendingComments: [] })
    const fetchMock = vi.fn(async () =>
      makeResponse({ data: { admin: false, recentComments: [], pendingComments: [] } }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const fresh = await getSidebarSnapshot({ bypassCache: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fresh.admin).toBe(false)
  })
})
