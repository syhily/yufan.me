import { vi } from 'vite-plus/test'

import type { Comment, Like, NewComment, NewUser, Page, User } from '@/server/db/types'

// Drizzle is fluent: `db.select().from(t).where(c).limit(n).orderBy(o)` etc.
// The chain methods all return `this`-ish builders that the caller eventually
// awaits to get the rows. Building a 1:1 fluent stub for every variant in our
// codebase would be brittle and add hundreds of lines, so we ship two
// complementary primitives:
//
//   1. `chainable(rows)` — a tiny builder that returns the same handle for
//      every Drizzle method we use, and resolves to `rows` when awaited. Use
//      this when a test really needs to swap the `db` singleton.
//   2. `mockQueryModule()` — replaces every named export of one of our
//      `src/db/query/*.server.ts` modules with a `vi.fn()`, returning the
//      typed spy bag so a test can `mocked.findRootComments.mockResolvedValue(...)`.
//      This is the path most tests should take: it isolates the test from
//      Drizzle entirely and pins the contract at the module boundary the rest
//      of the app actually consumes.
//
// Both helpers compose with the high-level `seedComments` / `seedLikes` /
// `seedUsers` factories so test fixtures stay declarative.

// --- Low-level: a Drizzle-shaped chainable. ---------------------------------

export type Chainable<T> = PromiseLike<T> & {
  [k: string]: (...args: unknown[]) => Chainable<T>
}

const CHAIN_METHODS = [
  'from',
  'innerJoin',
  'leftJoin',
  'rightJoin',
  'fullJoin',
  'where',
  'orderBy',
  'limit',
  'offset',
  'groupBy',
  'having',
  'values',
  'set',
  'returning',
  'onConflictDoNothing',
  'onConflictDoUpdate',
  'selectDistinct',
] as const

export function chainable<T>(rows: T): Chainable<T> {
  // The handle pretends to be a Drizzle builder: every chainable verb returns
  // the same Promise-backed handle, and awaiting it resolves to `rows`.
  const handle = Promise.resolve(rows) as unknown as Chainable<T>
  for (const method of CHAIN_METHODS) {
    Object.defineProperty(handle, method, {
      value: () => handle,
    })
  }
  return handle
}

export interface MockDb {
  select: ReturnType<typeof vi.fn>
  selectDistinct: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  execute: ReturnType<typeof vi.fn>
  /** Convenience: queue rows that the next select-chain will resolve to. */
  queueSelect<T>(rows: T): void
}

// `mockDb` is for the rare test that needs to replace `db` itself. The select
// chain returns whatever the latest queue entry holds; insert/update/delete
// resolve to no-ops by default. Tests can still override individual methods
// (e.g. `db.insert.mockReturnValue(chainable([{ id: 1 }]))`) for fine control.
export function mockDb(): MockDb {
  const queue: unknown[] = []
  const select = vi.fn(() => {
    const next = queue.length > 0 ? queue.shift() : []
    return chainable(next)
  })
  const selectDistinct = vi.fn(() => chainable(queue.length > 0 ? queue.shift() : []))
  const insert = vi.fn(() => chainable([] as unknown[]))
  const update = vi.fn(() => chainable([] as unknown[]))
  const del = vi.fn(() => chainable([] as unknown[]))
  const execute = vi.fn(async () => ({ rows: [] as unknown[] }))
  return {
    select,
    selectDistinct,
    insert,
    update,
    delete: del,
    execute,
    queueSelect(rows) {
      queue.push(rows)
    },
  }
}

// --- High-level: replace a query module's named exports with spies. --------

type QueryModuleSpec<TExports extends Record<string, (...args: never[]) => unknown>> = {
  [K in keyof TExports]: ReturnType<typeof vi.fn>
}

/**
 * Build a typed bag of `vi.fn()` spies that mirrors the exports of a
 * `@/server/db/query/*.ts` module. Pass the result to
 * `vi.mock("@/server/db/query/comment", () => mocked)` (or use
 * `installQueryMock` below).
 */
export function spyQueryModule<TExports extends Record<string, (...args: never[]) => unknown>>(
  keys: readonly (keyof TExports)[],
): QueryModuleSpec<TExports> {
  const out = {} as QueryModuleSpec<TExports>
  for (const key of keys) {
    out[key] = vi.fn()
  }
  return out
}

// --- Declarative fixtures for the most common rows ------------------------

let _id = 1n
function nextBigInt(): bigint {
  _id += 1n
  return _id
}
function resetIds(): void {
  _id = 1n
}

export interface CommentFixture extends Partial<Comment> {
  /** User row paired with this comment (for joined `commentWithUser` shape). */
  user?: Partial<User>
}

/**
 * Build a `commentWithUser`-shaped row matching what `findRootComments` /
 * `findChildComments` / `findCommentWithUserById` return. Defaults are
 * intentionally bland so individual tests only override what they care about.
 */
export function seedComment(overrides: CommentFixture = {}) {
  const id = overrides.id ?? nextBigInt()
  const userId = overrides.userId ?? nextBigInt()
  return {
    id,
    createAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01T00:00:00.000Z'),
    deleteAt: overrides.deletedAt ?? null,
    content: overrides.content ?? '<p>hi</p>',
    pageKey: overrides.pageKey ?? '/posts/hello',
    userId,
    isVerified: overrides.isVerified ?? true,
    ua: overrides.ua ?? '',
    ip: overrides.ip ?? '',
    rid: overrides.rid ?? 0,
    isCollapsed: overrides.isCollapsed ?? false,
    isPending: overrides.isPending ?? false,
    isPinned: overrides.isPinned ?? false,
    voteUp: overrides.voteUp ?? 0,
    voteDown: overrides.voteDown ?? 0,
    rootId: overrides.rootId ?? 0n,
    name: overrides.user?.name ?? 'Alice',
    email: overrides.user?.email ?? `user${userId}@example.com`,
    emailVerified: overrides.user?.emailVerified ?? true,
    link: overrides.user?.link ?? '',
    badgeName: overrides.user?.badgeName ?? null,
    badgeColor: overrides.user?.badgeColor ?? null,
  }
}

export function seedComments(specs: CommentFixture[]) {
  return specs.map((spec) => seedComment(spec))
}

export function seedUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? nextBigInt(),
    name: overrides.name ?? 'Alice',
    email: overrides.email ?? 'alice@example.com',
    emailVerified: overrides.emailVerified ?? true,
    link: overrides.link ?? '',
    isAdmin: overrides.isAdmin ?? false,
    badgeName: overrides.badgeName ?? null,
    badgeColor: overrides.badgeColor ?? null,
    createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01T00:00:00.000Z'),
  } as User
}

export function seedUsers(specs: Partial<User>[] = []): User[] {
  return specs.map((spec) => seedUser(spec))
}

export function seedLike(overrides: Partial<Like> = {}): Like {
  const now = overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z')
  return {
    id: overrides.id ?? nextBigInt(),
    token: overrides.token ?? 'token',
    pageKey: overrides.pageKey ?? '/posts/hello',
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
    deletedAt: overrides.deletedAt ?? null,
  } as Like
}

export function seedLikes(specs: Partial<Like>[]): Like[] {
  return specs.map((spec) => seedLike(spec))
}

export function seedPage(overrides: Partial<Page> = {}): Page {
  const now = overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z')
  return {
    id: overrides.id ?? nextBigInt(),
    key: overrides.key ?? '/posts/hello',
    title: overrides.title ?? 'Hello',
    pv: overrides.pv ?? 0,
    voteUp: overrides.voteUp ?? 0,
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
    deletedAt: overrides.deletedAt ?? null,
  } as Page
}

// Re-export NewUser/NewComment so a test can import the seed helpers and
// new-row types from a single place.
export type { NewComment, NewUser }

/** Reset the auto-increment id counter — call between tests for stability. */
export function resetSeedIds(): void {
  resetIds()
}
