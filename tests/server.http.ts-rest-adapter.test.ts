import { initContract } from '@ts-rest/core'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { Env } from '@/server/http/context'

import { onErrorHandler } from '@/server/http/errors'
import { mountContract } from '@/server/http/ts-rest-adapter'

const c = initContract()

const testContract = c.router({
  hello: {
    method: 'GET',
    path: '/hello',
    query: z.object({ name: z.string().min(1).default('world') }),
    responses: {
      200: z.object({ greeting: z.string() }),
    },
  },
  echo: {
    method: 'POST',
    path: '/echo',
    body: z.object({ message: z.string() }),
    responses: {
      201: z.object({ received: z.string() }),
    },
  },
  getById: {
    method: 'GET',
    path: '/items/:id',
    pathParams: z.object({ id: z.string().min(1) }),
    responses: {
      200: z.object({ id: z.string() }),
    },
  },
})

const testController = {
  hello: async ({ query }: { query: { name: string } }) => ({
    status: 200,
    body: { greeting: `Hello, ${query.name}` },
  }),
  echo: async ({ body }: { body: { message: string } }) => ({
    status: 201,
    body: { received: body.message },
  }),
  getById: async ({ params }: { params: { id: string } }) => ({
    status: 200,
    body: { id: params.id },
  }),
}

function createTestApp(): Hono<Env> {
  const app = new Hono<Env>()
  app.onError(onErrorHandler)
  mountContract(app, testContract, testController as any)
  return app
}

describe('ts-rest-adapter', () => {
  it('mounts GET route with query validation', async () => {
    const app = createTestApp()
    const res = await app.request('/hello?name=ts-rest')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.greeting).toBe('Hello, ts-rest')
  })

  it('applies default query values', async () => {
    const app = createTestApp()
    const res = await app.request('/hello')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.greeting).toBe('Hello, world')
  })

  it('mounts POST route with body validation', async () => {
    const app = createTestApp()
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.received).toBe('hi')
  })

  it('mounts route with path params', async () => {
    const app = createTestApp()
    const res = await app.request('/items/42')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('42')
  })

  it('returns 400 on invalid query', async () => {
    const app = createTestApp()
    const res = await app.request('/hello?name=')
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid body', async () => {
    const app = createTestApp()
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 123 }),
    })
    expect(res.status).toBe(400)
  })

  it('flags response body that mismatches schema (dev → 500)', async () => {
    const driftContract = c.router({
      drift: {
        method: 'GET',
        path: '/drift',
        responses: {
          200: z.object({ count: z.number() }),
        },
      },
    })
    const driftController = {
      // Intentionally wrong shape: `count` should be a number, not a string.
      drift: async () => ({ status: 200, body: { count: 'oops' as unknown as number } }),
    }
    const app = new Hono<Env>()
    app.onError(onErrorHandler)
    mountContract(app, driftContract, driftController as any)
    const res = await app.request('/drift')
    // In dev (vitest defaults to dev) the adapter rejects the mismatched
    // body with 500 + an issue list so the regression is unmissable.
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).toContain('count')
  })

  it('returns 204 with no body for noBody routes', async () => {
    const noBodyContract = c.router({
      remove: {
        method: 'DELETE',
        path: '/things/:id',
        pathParams: z.object({ id: z.string() }),
        body: c.noBody(),
        responses: { 204: c.noBody() },
      },
    })
    const noBodyController = {
      remove: async () => ({ status: 204, body: undefined }),
    }
    const app = new Hono<Env>()
    app.onError(onErrorHandler)
    mountContract(app, noBodyContract, noBodyController as any)
    const res = await app.request('/things/42', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })
})
