import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { seedPage } from './_helpers/db'
import { adminSession, regularSession } from './_helpers/session'

// `loadComments` is the most-called server function on the site (every post
// view runs it). It coordinates 4 DB queries and 1 page upsert, with
// admin-vs-public visibility flipping which `pending` rows are visible. We
// pin the contract by mocking the DB query module — the real Drizzle calls
// are out of scope for this layer.

vi.mock('@/server/db/query/comment', () => ({
  pendingComments: vi.fn(),
  adminUserIds: vi.fn(),
  latestDistinctCommentIds: vi.fn(),
  commentsByIds: vi.fn(),
  countCommentsAndRoots: vi.fn(),
  findRootComments: vi.fn(),
  findChildComments: vi.fn(),
  approveCommentById: vi.fn(),
  deleteCommentById: vi.fn(),
  insertComment: vi.fn(),
  countAllComments: vi.fn(),
  listAdminComments: vi.fn(),
  countApprovedCommentsByUser: vi.fn(),
  recentCommentsForUserDedupe: vi.fn(),
  findCommentRootId: vi.fn(),
  findCommentWithSourceUser: vi.fn(),
  findCommentWithUserAndPage: vi.fn(),
  findCommentWithUserById: vi.fn(),
  updateCommentContent: vi.fn(),
  listCommentAuthors: vi.fn(),
  listAllPages: vi.fn(),
}))

vi.mock('@/server/db/query/page', () => ({
  upsertPage: vi.fn(async () => undefined),
  findPageByKey: vi.fn(),
}))

vi.mock('@/server/metrics/batcher', () => ({
  bumpPageView: vi.fn(),
}))

vi.mock('@/server/email/sender', () => ({
  sendApprovedComment: vi.fn(async () => undefined),
  sendNewComment: vi.fn(async () => undefined),
  sendNewReply: vi.fn(async () => undefined),
}))

// `parseComments` / `createComment` now route every body through the
// runtime MDX compiler; mocking it keeps the loader tests fast (the
// real `@fumadocs/mdx-remote` pipeline pulls in a few hundred KB of
// MDX deps and adds ~100ms per call).
vi.mock('@/server/markdown/runtime', () => ({
  compileMarkdown: vi.fn(async (source: string | null | undefined) => {
    if (source === null || source === undefined) {
      return null
    }
    const trimmed = source.replace(/\r\n/g, '\n').trim()
    if (trimmed === '') {
      return null
    }
    return { compiled: `MOCK::${trimmed}`, plain: trimmed }
  }),
}))

const queries = await import('@/server/db/query/comment')
const pageQueries = await import('@/server/db/query/page')
const { loadComments, latestComments, pendingComments, parseComments, streamLoadComments } =
  await import('@/server/comments/loader')

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    createAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    deleteAt: null,
    content: '<p>x</p>',
    pageKey: '/posts/hello',
    userId: 7n,
    isVerified: true,
    ua: '',
    ip: '',
    rid: 0,
    isCollapsed: false,
    isPending: false,
    isPinned: false,
    voteUp: 0,
    voteDown: 0,
    rootId: 0n,
    name: 'Alice',
    email: 'a@example.com',
    emailVerified: true,
    link: '',
    badgeName: null,
    badgeColor: null,
    ...overrides,
  }
}

beforeEach(() => {
  for (const fn of Object.values({ ...queries, ...pageQueries })) {
    if (typeof fn === 'function' && 'mockReset' in fn) {
      ;(fn as ReturnType<typeof vi.fn>).mockReset()
    }
  }
})

describe('services/comments/loader — loadComments', () => {
  it('non-admins only see approved comments (pending=[false])', async () => {
    vi.mocked(queries.countCommentsAndRoots).mockResolvedValue({ total: 0, roots: 0 })
    vi.mocked(queries.findRootComments).mockResolvedValue([])
    vi.mocked(queries.findChildComments).mockResolvedValue([])

    await loadComments(regularSession(), '/posts/hello', 'Hello', 0)

    expect(queries.countCommentsAndRoots).toHaveBeenCalledWith('/posts/hello', [false])
    expect(queries.findRootComments).toHaveBeenCalledWith('/posts/hello', [false], 0, expect.any(Number))
  })

  it('admins additionally see pending comments (pending=[false,true])', async () => {
    vi.mocked(queries.countCommentsAndRoots).mockResolvedValue({ total: 0, roots: 0 })
    vi.mocked(queries.findRootComments).mockResolvedValue([])
    vi.mocked(queries.findChildComments).mockResolvedValue([])

    await loadComments(adminSession(), '/posts/hello', 'Hello', 0)

    expect(queries.countCommentsAndRoots).toHaveBeenCalledWith('/posts/hello', [false, true])
    expect(queries.findRootComments).toHaveBeenCalledWith('/posts/hello', [false, true], 0, expect.any(Number))
  })

  it('returns the union of root + child comments and the aggregated counts', async () => {
    vi.mocked(queries.countCommentsAndRoots).mockResolvedValue({ total: 5, roots: 2 })
    vi.mocked(queries.findRootComments).mockResolvedValue([row({ id: 1n }), row({ id: 2n })])
    vi.mocked(queries.findChildComments).mockResolvedValue([
      row({ id: 3n, rid: 1, rootId: 1n }),
      row({ id: 4n, rid: 1, rootId: 1n }),
      row({ id: 5n, rid: 2, rootId: 2n }),
    ])

    const result = await loadComments(regularSession(), '/posts/hello', 'Hello', 0)

    expect(result?.count).toBe(5)
    expect(result?.roots_count).toBe(2)
    expect(result?.comments).toHaveLength(5)
    // Verify the join: child fetch was called with the root ids only.
    expect(queries.findChildComments).toHaveBeenCalledWith('/posts/hello', [false], [1n, 2n])
  })

  it('upserts the page even when the page has zero comments', async () => {
    vi.mocked(queries.countCommentsAndRoots).mockResolvedValue({ total: 0, roots: 0 })
    vi.mocked(queries.findRootComments).mockResolvedValue([])
    vi.mocked(queries.findChildComments).mockResolvedValue([])

    await loadComments(regularSession(), '/posts/new', 'New post', 0)

    expect(pageQueries.upsertPage).toHaveBeenCalledWith('/posts/new', 'New post')
  })

  it('issues page upsert + counts + root listing in parallel (single tick)', async () => {
    let inflight = 0
    let peak = 0
    function tracked<T>(value: T) {
      return new Promise<T>((resolve) => {
        inflight += 1
        peak = Math.max(peak, inflight)
        setTimeout(() => {
          inflight -= 1
          resolve(value)
        }, 20)
      })
    }
    vi.mocked(pageQueries.upsertPage).mockImplementation((key, title) =>
      tracked(seedPage({ key, title: title ?? '无标题' })),
    )
    vi.mocked(queries.countCommentsAndRoots).mockImplementation(() => tracked({ total: 0, roots: 0 }))
    vi.mocked(queries.findRootComments).mockImplementation(() => tracked([]))
    vi.mocked(queries.findChildComments).mockResolvedValue([])

    await loadComments(regularSession(), '/posts/parallel', 'Parallel', 0)

    expect(peak).toBe(3)
  })
})

describe('services/comments/loader — latestComments / pendingComments', () => {
  it('latestComments resolves authors and skips admins from the pool', async () => {
    vi.mocked(queries.adminUserIds).mockResolvedValue([99n])
    vi.mocked(queries.latestDistinctCommentIds).mockResolvedValue([10n, 20n])
    vi.mocked(queries.commentsByIds).mockResolvedValue([
      { id: 10n, page: '/posts/a', title: 'A', author: 'Alice', authorLink: '' },
      { id: 20n, page: '/posts/b', title: null, author: null, authorLink: null },
    ])

    const list = await latestComments()

    expect(queries.adminUserIds).toHaveBeenCalledOnce()
    expect(queries.latestDistinctCommentIds).toHaveBeenCalledWith([99n], expect.any(Number))
    expect(list).toHaveLength(2)
    expect(list[0].permalink).toBe('/posts/a#user-comment-10')
    // Null author/title fall back to empty string (sidebar must never crash).
    expect(list[1].author).toBe('')
    expect(list[1].title).toBe('')
  })

  it('pendingComments forwards the configured sidebar size', async () => {
    vi.mocked(queries.pendingComments).mockResolvedValue([])
    await pendingComments()
    expect(queries.pendingComments).toHaveBeenCalledWith(expect.any(Number))
  })
})

describe('services/comments/loader — parseComments', () => {
  it('adds a server-computed readable text color for comment badges', async () => {
    const comments = await parseComments([row({ badgeName: '站长', badgeColor: '#6ab7ca' })])

    expect(comments[0].badgeTextColor).toBe('#151b2b')
  })
})

describe('services/comments/loader — streamLoadComments', () => {
  it('emits meta first, then one item per root subtree, then end', async () => {
    vi.mocked(queries.countCommentsAndRoots).mockResolvedValue({ total: 4, roots: 2 })
    vi.mocked(queries.findRootComments).mockResolvedValue([row({ id: 1n }), row({ id: 2n })])
    vi.mocked(queries.findChildComments).mockResolvedValue([
      row({ id: 3n, rid: 1, rootId: 1n }),
      row({ id: 4n, rid: 2, rootId: 2n }),
    ])

    const lines: unknown[] = []
    for await (const line of streamLoadComments(regularSession(), '/posts/hello', 0)) {
      lines.push(line)
    }

    // Order contract: meta, one item per root (in order), end.
    expect(lines[0]).toMatchObject({ type: 'meta', count: 4, roots_count: 2, next: false })
    expect(lines[1]).toMatchObject({ type: 'item' })
    expect((lines[1] as { type: 'item'; comment: { id: bigint } }).comment.id).toBe(1n)
    expect(lines[2]).toMatchObject({ type: 'item' })
    expect((lines[2] as { type: 'item'; comment: { id: bigint } }).comment.id).toBe(2n)
    expect(lines[3]).toEqual({ type: 'end' })
  })

  it('reports next=true when more roots remain past the current page', async () => {
    // 100 roots total, page size config.settings.comments.size (default 10),
    // offset 0 → next page exists.
    vi.mocked(queries.countCommentsAndRoots).mockResolvedValue({ total: 100, roots: 100 })
    vi.mocked(queries.findRootComments).mockResolvedValue([row({ id: 1n })])
    vi.mocked(queries.findChildComments).mockResolvedValue([])

    const iterator = streamLoadComments(regularSession(), '/posts/big', 0)
    const meta = (await iterator.next()).value
    await iterator.return?.()

    expect(meta).toMatchObject({ type: 'meta', next: true })
  })

  it('respects admin visibility (pending=[false,true]) on the streaming path', async () => {
    vi.mocked(queries.countCommentsAndRoots).mockResolvedValue({ total: 0, roots: 0 })
    vi.mocked(queries.findRootComments).mockResolvedValue([])
    vi.mocked(queries.findChildComments).mockResolvedValue([])

    const iterator = streamLoadComments(adminSession(), '/posts/admin', 0)
    await iterator.next()
    await iterator.return?.()

    expect(queries.countCommentsAndRoots).toHaveBeenCalledWith('/posts/admin', [false, true])
    expect(queries.findRootComments).toHaveBeenCalledWith('/posts/admin', [false, true], 0, expect.any(Number))
  })
})
