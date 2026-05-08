import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { adminSession, regularSession } from './_helpers/session'

vi.mock('@/server/comments/loader', () => ({
  latestComments: vi.fn(),
}))

const loader = await import('@/server/comments/loader')
const { loadSidebarData } = await import('@/server/settings/sidebar/load')

beforeEach(() => {
  vi.mocked(loader.latestComments).mockReset()
  vi.mocked(loader.latestComments).mockResolvedValue([
    {
      title: 'Hello',
      author: 'Alice',
      authorLink: '',
      permalink: '/posts/hello#user-comment-1',
    },
  ])
})

describe('services/sidebar/load — loadSidebarData', () => {
  it('non-admin session reports admin=false and returns latest comments', async () => {
    const data = await loadSidebarData(regularSession())

    expect(data.admin).toBe(false)
    expect(data.recentComments).toHaveLength(1)
  })

  it('admin session reports admin=true and returns latest comments', async () => {
    const data = await loadSidebarData(adminSession())

    expect(data.admin).toBe(true)
    expect(data.recentComments).toHaveLength(1)
  })
})
