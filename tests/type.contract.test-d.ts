import type { ClientInferRequest, ClientInferResponseBody } from '@ts-rest/core'

import { describe, expectTypeOf, it } from 'vitest'

import { apiContract } from '@/shared/contracts'

// Type-level smoke tests for the public surface of every contract.
// Each `it` block uses `expectTypeOf<...>().toMatchTypeOf<...>()` to
// assert a structural lower-bound on the inferred wire shape. The
// `toMatchTypeOf` direction is intentional: the contract may add
// extra fields without breaking the test, but missing fields fail
// the build. This pairs with the runtime Zod parity assertions in
// `src/shared/contracts/_dtos.ts` so the wire surface is locked on
// both axes (compile + runtime).

describe('response body inference (admin)', () => {
  it('admin.users.list', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.users.list, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ users: unknown[]; total: number; hasMore: boolean }>()
  })

  it('admin.users.get', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.users.get, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ user: { id: string; name: string } }>()
  })

  it('admin.posts.list', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.posts.list, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ posts: unknown[]; total: number; hasMore: boolean }>()
  })

  it('admin.posts.get', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.posts.get, 200>
    expectTypeOf<Body>().toMatchTypeOf<{
      post: { id: string; slug: string; title: string }
    }>()
  })

  it('admin.pages.list', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.pages.list, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ pages: unknown[]; total: number; hasMore: boolean }>()
  })

  it('admin.categories.list', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.categories.list, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ categories: unknown[]; total: number }>()
  })

  it('admin.tags.list', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.tags.list, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ tags: unknown[]; total: number; hasMore: boolean }>()
  })

  it('admin.friends.list', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.friends.list, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ friends: unknown[]; total: number; hasMore: boolean }>()
  })

  it('admin.images.list', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.images.list, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ images: unknown[]; total: number; hasMore: boolean }>()
  })

  it('admin.music.list', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.music.list, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ musics: unknown[]; total: number; hasMore: boolean }>()
  })

  it('admin.cache.getStats', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.cache.getStats, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ buckets: unknown[]; total: number }>()
  })

  it('admin.settings.get', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.settings.get, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ bundle: unknown }>()
  })

  it('admin.renders.math', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.renders.math, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ mathml: string; error: string | null }>()
  })

  it('admin.renders.mermaid', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.renders.mermaid, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ svg: string; error: string | null }>()
  })

  it('admin.mail.sendTest', () => {
    type Body = ClientInferResponseBody<typeof apiContract.admin.mail.sendTest, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ success: boolean }>()
  })
})

describe('response body inference (public)', () => {
  it('account.updateProfile', () => {
    type Body = ClientInferResponseBody<typeof apiContract.account.updateProfile, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ user: unknown }>()
  })

  it('commentPublic.loadComments', () => {
    type Body = ClientInferResponseBody<typeof apiContract.commentPublic.loadComments, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ comments: unknown[]; next: boolean }>()
  })

  it('commentAdmin.loadAll', () => {
    type Body = ClientInferResponseBody<typeof apiContract.commentAdmin.loadAll, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ comments: unknown[]; total: number; hasMore: boolean }>()
  })

  it('commentSelf.listMine', () => {
    type Body = ClientInferResponseBody<typeof apiContract.commentSelf.listMine, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ comments: unknown[]; total: number; hasMore: boolean }>()
  })

  it('commentToken.myComments', () => {
    type Body = ClientInferResponseBody<typeof apiContract.commentToken.myComments, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ comments: unknown[]; expiresAt: Record<string, number> }>()
  })

  it('image.resolveThumbhash', () => {
    type Body = ClientInferResponseBody<typeof apiContract.image.resolveThumbhash, 200>
    expectTypeOf<Body>().toMatchTypeOf<unknown>()
  })

  it('music.get', () => {
    type Body = ClientInferResponseBody<typeof apiContract.music.get, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ music: unknown }>()
  })

  it('analytics.metrics', () => {
    type Body = ClientInferResponseBody<typeof apiContract.analytics.metrics, 200>
    expectTypeOf<Body>().toMatchTypeOf<unknown[]>()
  })
})

describe('request input inference', () => {
  // ClientInferRequest's literal-discriminated query / body types
  // diverge across endpoints, so we test the simplest shape — path
  // params — which are uniformly `{ id: string }` for resource
  // endpoints. Body / query inference is exercised indirectly via
  // the controller suites (which call `api.<x>(...)` with concrete
  // payloads).

  it('admin.users.get takes a string path id', () => {
    type Req = ClientInferRequest<typeof apiContract.admin.users.get>
    expectTypeOf<Req['params']>().toMatchTypeOf<{ id: string }>()
  })

  it('admin.posts.get takes a string path id', () => {
    type Req = ClientInferRequest<typeof apiContract.admin.posts.get>
    expectTypeOf<Req['params']>().toMatchTypeOf<{ id: string }>()
  })

  it('admin.users.mute body has the muted boolean', () => {
    type Req = ClientInferRequest<typeof apiContract.admin.users.mute>
    expectTypeOf<Req['body']>().toMatchTypeOf<{ muted: boolean }>()
  })
})
