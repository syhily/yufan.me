import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vite-plus/test'

import type { Env } from '@/server/http/context'

// The install gate calls `hydrateBlogSettings()` (DB + Redis) and
// `hasAdmin()` (DB). We stub both so we can drive the three install
// states directly.

const mockHasAdmin = vi.fn()
const mockHydrateBlogSettings = vi.fn()

vi.mock('@/server/infra/db/operations/user', () => ({
  hasAdmin: () => mockHasAdmin(),
}))

vi.mock('@/server/domains/settings/snapshot', () => ({
  hydrateBlogSettings: () => mockHydrateBlogSettings(),
}))

async function createApp(): Promise<Hono<Env>> {
  const { honoInstallGateMiddleware } = await import('@/server/http/middlewares/install-gate')
  const app = new Hono<Env>()
  app.use(honoInstallGateMiddleware)
  app.all('*', (c) => c.json({ passed: true, path: c.req.path }, 200))
  return app
}

describe('honoInstallGateMiddleware', () => {
  it('lets exempt exact paths through in any state', async () => {
    mockHasAdmin.mockResolvedValue(false)
    mockHydrateBlogSettings.mockResolvedValue(null)

    const app = await createApp()
    const res = await app.request('/admin/setup')
    expect(res.status).toBe(200)
  })

  it('lets exempt exact paths with React Router .data suffix through in noAdmin state', async () => {
    mockHasAdmin.mockResolvedValue(false)
    mockHydrateBlogSettings.mockResolvedValue(null)

    const app = await createApp()
    const res = await app.request('/admin/setup.data', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  it('lets exempt exact paths with .data suffix through in noSettings state', async () => {
    mockHasAdmin.mockResolvedValue(true)
    mockHydrateBlogSettings.mockResolvedValue(null)

    const app = await createApp()
    const res = await app.request('/admin/setup/settings.data', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  it('lets exempt exact paths with .data suffix through in installed state', async () => {
    mockHasAdmin.mockResolvedValue(true)
    mockHydrateBlogSettings.mockResolvedValue({ general: {}, assets: {} })

    const app = await createApp()
    const res = await app.request('/admin/signin.data', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  it('still redirects non-exempt .data requests in noAdmin state', async () => {
    mockHasAdmin.mockResolvedValue(false)
    mockHydrateBlogSettings.mockResolvedValue(null)

    const app = await createApp()
    const res = await app.request('/admin/some-other.php.data', { method: 'POST' })
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/admin/setup')
  })

  it('redirects non-exempt requests in noSettings state', async () => {
    mockHasAdmin.mockResolvedValue(true)
    mockHydrateBlogSettings.mockResolvedValue(null)

    const app = await createApp()
    const res = await app.request('/dashboard')
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/admin/setup/settings')
  })

  it('redirects non-exempt requests in noAdmin state', async () => {
    mockHasAdmin.mockResolvedValue(false)
    mockHydrateBlogSettings.mockResolvedValue(null)

    const app = await createApp()
    const res = await app.request('/dashboard')
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/admin/setup')
  })
})
