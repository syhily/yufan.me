import { call } from '@orpc/server'
import { describe, expect, it } from 'vite-plus/test'

import { makePublicCtx } from './_helpers/mock-ctx'

const { csrfRouter } = await import('@/server/http/controllers/csrf.controller')

describe('csrfRouter.refresh', () => {
  it('returns a new token and sets the csrf-token cookie', async () => {
    const ctx = makePublicCtx()
    const res = (await call(csrfRouter.refresh, {}, { context: ctx })) as { token: string }

    expect(res.token).toBeDefined()
    expect(typeof res.token).toBe('string')
    expect(res.token.length).toBe(48)

    // The Set-Cookie header should be present on the mutable responseHeaders bag.
    const setCookie = ctx.responseHeaders.get('Set-Cookie')
    expect(setCookie).not.toBeNull()
    expect(setCookie).toContain('csrf-token=')
    expect(setCookie).toContain('HttpOnly')
  })
})
