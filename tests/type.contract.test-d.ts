import type { ClientInferResponseBody } from '@ts-rest/core'

import { describe, expectTypeOf, it } from 'vitest'

import { apiContract } from '@/shared/contracts'

describe('contract type inference', () => {
  it('infers comment list response body', () => {
    type Body = ClientInferResponseBody<typeof apiContract.comment.loadComments, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ comments: unknown[]; next: boolean }>()
  })

  it('infers music get response body', () => {
    type Body = ClientInferResponseBody<typeof apiContract.music.get, 200>
    expectTypeOf<Body>().toMatchTypeOf<{ music: unknown }>()
  })

  it('infers analytics metrics response body', () => {
    type Body = ClientInferResponseBody<typeof apiContract.analytics.metrics, 200>
    expectTypeOf<Body>().toMatchTypeOf<unknown[]>()
  })
})
