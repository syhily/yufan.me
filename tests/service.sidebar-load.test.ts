import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { adminSession, regularSession } from './_helpers/session'

vi.mock('@/server/comments/loader', () => ({
  latestComments: vi.fn(),
  pendingComments: vi.fn(),
}))

const loader = await import('@/server/comments/loader')
const { loadSidebarData } = await import('@/server/sidebar/load')

beforeEach(() => {
  vi.mocked(loader.latestComments).mockReset()
  vi.mocked(loader.pendingComments).mockReset()
  vi.mocked(loader.latestComments).mockResolvedValue([
    {
      title: 'Hello',
      author: 'Alice',
      authorLink: '',
      permalink: '/posts/hello#user-comment-1',
    },
  ])
  vi.mocked(loader.pendingComments).mockResolvedValue([
    {
      title: 'Pending',
      author: 'Bob',
      authorLink: '',
      permalink: '/posts/p#user-comment-2',
    },
  ])
})

describe('services/sidebar/load — loadSidebarData', () => {
  it('non-admins never trigger the pendingComments query', async () => {
    const data = await loadSidebarData(regularSession())

    expect(data.admin).toBe(false)
    expect(data.recentComments).toHaveLength(1)
    expect(data.pendingComments).toEqual([])
    expect(loader.pendingComments).not.toHaveBeenCalled()
  })

  it('admins receive both recent and pending comment lists', async () => {
    const data = await loadSidebarData(adminSession())

    expect(data.admin).toBe(true)
    expect(data.recentComments).toHaveLength(1)
    expect(data.pendingComments).toHaveLength(1)
    expect(loader.pendingComments).toHaveBeenCalledOnce()
  })

  it('recent + pending queries fan out in parallel for admins', async () => {
    let inflight = 0
    let peak = 0
    function tracked<T>(value: T) {
      return new Promise<T>((resolve) => {
        inflight += 1
        peak = Math.max(peak, inflight)
        setTimeout(() => {
          inflight -= 1
          resolve(value)
        }, 10)
      })
    }
    vi.mocked(loader.latestComments).mockImplementation(() => tracked([]))
    vi.mocked(loader.pendingComments).mockImplementation(() => tracked([]))

    await loadSidebarData(adminSession())

    expect(peak).toBe(2)
  })
})
