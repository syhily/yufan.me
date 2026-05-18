import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// Tests for the relocated taxonomy query functions that previously lived
// in `@/server/domains/catalog/queries.ts`.

// A helper that returns a chainable query builder ending in a Promise.
function makeQueryBuilder(finalResult: unknown) {
  const chain = {
    from: () => chain,
    orderBy: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    limit: () => chain,
    offset: () => chain,
    // oxlint-disable-next-line unicorn/no-thenable
    then: (resolve: (value: unknown) => unknown) => resolve(finalResult),
  }
  return chain
}

const mockDb = vi.hoisted(() => ({
  select: vi.fn((_cols?: unknown) => makeQueryBuilder([])),
  execute: vi.fn(() => Promise.resolve({ rows: [] as unknown[] })),
}))

vi.mock('@/server/infra/db/pool', () => ({
  db: mockDb,
}))

vi.mock('@/server/infra/db/schema', () => ({
  category: {
    name: 'category.name',
    slug: 'category.slug',
    cover: 'category.cover',
    description: 'category.description',
    sortOrder: 'category.sortOrder',
    id: 'category.id',
  },
  post: {
    category: 'post.category',
    deletedAt: 'post.deleted_at',
    published: 'post.published',
    visible: 'post.visible',
    publishedAt: 'post.published_at',
    tags: 'post.tags',
  },
  tag: { name: 'tag.name', slug: 'tag.slug' },
}))

vi.mock('drizzle-orm', () => ({
  asc: vi.fn((col: string) => ({ direction: 'asc', col })),
  eq: vi.fn((col: string, val: unknown) => ({ col, val })),
  inArray: vi.fn((col: string, vals: unknown[]) => ({ col, vals })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, s, i) => acc + s + (values[i] !== undefined ? `?${i}` : ''), '')
    return { text, values, as: vi.fn((name: string) => ({ name, text })) }
  }) as unknown as typeof import('drizzle-orm').sql,
}))

vi.mock('@/server/render/image-enhance', () => ({
  hydrateImageRefs: vi.fn(async () => undefined),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockImplementation(() => makeQueryBuilder([]))
  mockDb.execute.mockImplementation(() => Promise.resolve({ rows: [] }))
})

describe('listAllCategories', () => {
  it('returns categories with permalink format /cats/slug', async () => {
    mockDb.select.mockImplementation(() =>
      makeQueryBuilder([{ name: 'Tech', slug: 'tech', cover: '/tech.jpg', description: 'Tech stuff', counts: 5 }]),
    )

    const { listAllCategories } = await import('@/server/domains/taxonomies/categories/service')
    const cats = await listAllCategories()

    expect(cats).toHaveLength(1)
    expect(cats[0].permalink).toBe('/cats/tech')
    expect(cats[0].name).toBe('Tech')
  })

  it('hydrates category cover images', async () => {
    mockDb.select.mockImplementation(() =>
      makeQueryBuilder([{ name: 'A', slug: 'a', cover: '/a.jpg', description: '', counts: 0 }]),
    )

    const { listAllCategories } = await import('@/server/domains/taxonomies/categories/service')
    await listAllCategories()

    const { hydrateImageRefs } = await import('@/server/render/image-enhance')
    expect(hydrateImageRefs).toHaveBeenCalled()
  })

  it('empty result → empty array', async () => {
    mockDb.select.mockImplementation(() => makeQueryBuilder([]))

    const { listAllCategories } = await import('@/server/domains/taxonomies/categories/service')
    const cats = await listAllCategories()

    expect(cats).toEqual([])
  })
})

describe('getCategoryLinks', () => {
  it('returns Record<name, link> for matched names', async () => {
    mockDb.select.mockImplementation(() =>
      makeQueryBuilder([
        { name: 'Tech', slug: 'tech' },
        { name: 'Life', slug: 'life' },
      ]),
    )

    const { getCategoryLinks } = await import('@/server/domains/taxonomies/categories/service')
    const links = await getCategoryLinks(['Tech', 'Life'])

    expect(links['Tech']).toBe('/cats/tech')
    expect(links['Life']).toBe('/cats/life')
  })

  it('filters out null/empty names', async () => {
    mockDb.select.mockImplementation(() => makeQueryBuilder([]))

    const { getCategoryLinks } = await import('@/server/domains/taxonomies/categories/service')
    const links = await getCategoryLinks(['', null as unknown as string, undefined as unknown as string])

    expect(Object.keys(links)).toHaveLength(0)
  })

  it('deduplicates names', async () => {
    mockDb.select.mockImplementation(() => makeQueryBuilder([{ name: 'Tech', slug: 'tech' }]))

    const { getCategoryLinks } = await import('@/server/domains/taxonomies/categories/service')
    const links = await getCategoryLinks(['Tech', 'Tech', 'Tech'])

    expect(Object.keys(links)).toHaveLength(1)
  })
})

describe('getCategoryLink', () => {
  it('returns /cats/slug for an existing category', async () => {
    mockDb.select.mockImplementation(() => makeQueryBuilder([{ name: 'Tech', slug: 'tech' }]))

    const { getCategoryLink } = await import('@/server/domains/taxonomies/categories/service')
    const link = await getCategoryLink('Tech')

    expect(link).toBe('/cats/tech')
  })

  it('returns empty string for a non-existent category', async () => {
    mockDb.select.mockImplementation(() => makeQueryBuilder([]))

    const { getCategoryLink } = await import('@/server/domains/taxonomies/categories/service')
    const link = await getCategoryLink('Unknown')

    expect(link).toBe('')
  })
})

describe('listAllTags', () => {
  // listAllTags has a 30-second process-level cache. We need fresh imports
  // so the cache variables are reset between tests.
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns tags with permalink /tags/slug', async () => {
    mockDb.select.mockImplementation((cols: unknown) => {
      // First call is the tag select, second would be counts
      if (cols && typeof cols === 'object' && 'name' in cols) {
        return makeQueryBuilder([{ name: 'React', slug: 'react' }])
      }
      return makeQueryBuilder([])
    })
    mockDb.execute.mockImplementation(() => Promise.resolve({ rows: [{ tag_name: 'React', counts: 3 }] }))

    const { listAllTags } = await import('@/server/domains/taxonomies/tags/service')
    const tags = await listAllTags()

    expect(tags).toHaveLength(1)
    expect(tags[0].permalink).toBe('/tags/react')
    expect(tags[0].counts).toBe(3)
  })

  it('tags with zero posts have counts = 0', async () => {
    mockDb.select.mockImplementation(() => makeQueryBuilder([{ name: 'Rust', slug: 'rust' }]))
    mockDb.execute.mockImplementation(() => Promise.resolve({ rows: [] }))

    const { listAllTags } = await import('@/server/domains/taxonomies/tags/service')
    const tags = await listAllTags()

    expect(tags[0].counts).toBe(0)
  })
})

describe('getTagsByNames', () => {
  it('returns tags in input name order', async () => {
    mockDb.select.mockImplementation(() =>
      makeQueryBuilder([
        { name: 'Vue', slug: 'vue' },
        { name: 'React', slug: 'react' },
      ]),
    )
    mockDb.execute.mockImplementation(() =>
      Promise.resolve({
        rows: [
          { tag_name: 'Vue', counts: 2 },
          { tag_name: 'React', counts: 5 },
        ],
      }),
    )

    const { getTagsByNames } = await import('@/server/domains/taxonomies/tags/service')
    const tags = await getTagsByNames(['Vue', 'React'])

    expect(tags[0].name).toBe('Vue')
    expect(tags[1].name).toBe('React')
  })

  it('filters out unknown names', async () => {
    mockDb.select.mockImplementation(() => makeQueryBuilder([]))
    mockDb.execute.mockImplementation(() => Promise.resolve({ rows: [] }))

    const { getTagsByNames } = await import('@/server/domains/taxonomies/tags/service')
    const tags = await getTagsByNames(['Unknown'])

    expect(tags).toEqual([])
  })

  it('empty input → empty array', async () => {
    const { getTagsByNames } = await import('@/server/domains/taxonomies/tags/service')
    const tags = await getTagsByNames([])

    expect(tags).toEqual([])
  })

  it('deduplicates input names', async () => {
    mockDb.select.mockImplementation(() => makeQueryBuilder([{ name: 'React', slug: 'react' }]))
    mockDb.execute.mockImplementation(() => Promise.resolve({ rows: [{ tag_name: 'React', counts: 3 }] }))

    const { getTagsByNames } = await import('@/server/domains/taxonomies/tags/service')
    const tags = await getTagsByNames(['React', 'React', 'React'])

    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('React')
  })
})

describe('listAllFriends', () => {
  it('is exported from friends service', async () => {
    const { listAllFriends } = await import('@/server/domains/friends/service')
    expect(typeof listAllFriends).toBe('function')
  })
})
