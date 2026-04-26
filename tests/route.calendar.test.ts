import { describe, expect, it, vi } from 'vite-plus/test'

import { loader as calendarLoader } from '@/routes/image.calendar'

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

describe('routes/image.calendar — input validation', () => {
  it('rejects out-of-range months with 404', async () => {
    await expect(
      calendarLoader({
        params: { year: '2026', time: '1340' },
        request: getRequest('http://localhost/images/calendar/2026/1340.png'),
      } as never),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('rejects out-of-range days with 404', async () => {
    await expect(
      calendarLoader({
        params: { year: '2026', time: '0231' },
        request: getRequest('http://localhost/images/calendar/2026/0231.png'),
      } as never),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('rejects non-numeric segments with 404', async () => {
    await expect(
      calendarLoader({
        params: { year: 'abcd', time: '0101' },
        request: getRequest('http://localhost/images/calendar/abcd/0101.png'),
      } as never),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      calendarLoader({
        params: { year: '2026', time: '11' },
        request: getRequest('http://localhost/images/calendar/2026/11.png'),
      } as never),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('includes cache headers on the direct PNG response', async () => {
    const response = await calendarLoader({
      params: { year: '2026', time: '0101' },
      request: getRequest('http://localhost/images/calendar/2026/0101.png'),
    } as never)

    expect(response.headers.get('content-type')).toContain('image/png')
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
  })
})
