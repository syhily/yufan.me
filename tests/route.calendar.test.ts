import { describe, expect, it, vi } from 'vite-plus/test'

import { getRequest } from './_helpers/request'

// Calendar URL is part of the public surface (`AGENTS.md`: image endpoints
// must remain stable). We don't render the actual PNG here — instead we
// assert the input validation gate that protects the canvas pipeline.

vi.mock('@/server/cache/image', () => ({
  loadBuffer: vi.fn(async () => new Uint8Array([1, 2, 3])),
}))

vi.mock('@/server/images/calendar', () => ({
  renderCalendar: vi.fn(async () => new Uint8Array([1, 2, 3])),
}))

const { imagesRouter } = await import('@/server/http/resources/images')

describe('routes/images calendar — input validation', () => {
  it('rejects out-of-range months with 404', async () => {
    const res = await imagesRouter.request(getRequest('http://localhost/images/calendar/2026/1340.png'))
    expect(res.status).toBe(404)
  })

  it('rejects out-of-range days with 404', async () => {
    const res = await imagesRouter.request(getRequest('http://localhost/images/calendar/2026/0231.png'))
    expect(res.status).toBe(404)
  })

  it('rejects non-numeric segments with 404', async () => {
    const res1 = await imagesRouter.request(getRequest('http://localhost/images/calendar/abcd/0101.png'))
    expect(res1.status).toBe(404)
    const res2 = await imagesRouter.request(getRequest('http://localhost/images/calendar/2026/11.png'))
    expect(res2.status).toBe(404)
  })

  it('includes cache headers on the direct PNG response', async () => {
    const response = await imagesRouter.request(getRequest('http://localhost/images/calendar/2026/0101.png'))

    expect(response.headers.get('content-type')).toContain('image/png')
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
  })
})
