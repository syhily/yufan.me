import { describe, expect, it } from 'vite-plus/test'
import { z } from 'zod'

import { ActionFailure, fail, ok, parseInput, runApi } from '@/server/route-helpers/api-handler'

import { makeLoaderArgs } from './_helpers/context'

// Pin the JSON contract every Resource Route emits. Every `useFetcher`
// consumer (comments, likes, admin) unwraps `.data` on success / reads
// `.error` on failure, so drift here breaks every React-driven flow.

const apiArgs = (request: Request = new Request('http://localhost/api/test')) => makeLoaderArgs({ request })

describe('contract: API payload envelope shape', () => {
  it('ok() emits exactly { data: ... } and never sets `error`', async () => {
    const body = await ok({ count: 3 }).json()
    expect(body).toEqual({ data: { count: 3 } })
  })

  it('ok() serializes bigint fields as decimal strings', async () => {
    const body = await ok({ id: 9007199254740993n }).json()
    expect(body).toEqual({ data: { id: '9007199254740993' } })
  })

  it('fail() emits exactly { error: { message, issues? } }', async () => {
    const body = await fail(400, 'x', [{ message: 'must be int' }]).json()
    expect(body).toEqual({ error: { message: 'x', issues: [{ message: 'must be int' }] } })
  })

  it('zod validation failures land in the standard envelope (status 400)', async () => {
    const schema = z.object({ rid: z.string() })
    try {
      await parseInput(schema, { rid: 1 })
      throw new Error('expected parseInput to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ActionFailure)
      const failure = error as ActionFailure
      expect(failure.status).toBe(400)
      expect(failure.issues?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('runApi keeps the success envelope at { data: T } even for primitive returns', async () => {
    const response = await runApi(apiArgs(), () => 42)
    expect(await response.json()).toEqual({ data: 42 })
  })

  it('runApi keeps the success envelope at { data: null } for `null` returns', async () => {
    const response = await runApi(apiArgs(), () => null)
    expect(await response.json()).toEqual({ data: null })
  })

  it('runApi serializes nested bigint ids before emitting JSON', async () => {
    const response = await runApi(apiArgs(), () => ({
      comment: {
        id: 9007199254740993n,
        children: [{ id: 9007199254740994n }],
      },
    }))
    expect(await response.json()).toEqual({
      data: {
        comment: {
          id: '9007199254740993',
          children: [{ id: '9007199254740994' }],
        },
      },
    })
  })

  it('runApi 500 fallback keeps the public message generic and adds X-Request-Id', async () => {
    const response = await runApi(apiArgs(), () => {
      throw new Error('internal: secret stack info')
    })
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.error.message).toBe('服务器内部错误')
    expect(body.error.message).not.toContain('secret')
    expect(response.headers.get('X-Request-Id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })
})
