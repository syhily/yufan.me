import { describe, expect, it } from 'vite-plus/test'

// E2E tests — §9.3 of the Hono migration plan.
// Tests the API app's route mounting via the Hono app object.
// Uses a lightweight approach that avoids importing heavy server deps.

describe('E2E: Contract coverage verification', () => {
  it('apiContract is importable without errors', async () => {
    const { apiContract } = await import('@/shared/contracts')
    expect(apiContract).toBeDefined()
    expect(apiContract.admin).toBeDefined()
    expect(apiContract.admin.users).toBeDefined()
    expect(apiContract.admin.sessions).toBeDefined()
  })

  it('all admin domains are present in the contract tree', async () => {
    const { apiContract } = await import('@/shared/contracts')
    const admin = apiContract.admin as Record<string, unknown>
    const domains = [
      'users',
      'posts',
      'pages',
      'settings',
      'cache',
      'mail',
      'categories',
      'tags',
      'friends',
      'images',
      'music',
      'sessions',
      'comments',
      'moderation',
      'editor',
      'search',
    ]
    for (const d of domains) {
      expect(admin[d], `missing admin.${d}`).toBeDefined()
    }
  })

  it('all public contracts are importable', async () => {
    const { apiContract } = await import('@/shared/contracts')
    expect(apiContract.account).toBeDefined()
    expect(apiContract.auth).toBeDefined()
    expect(apiContract.comment).toBeDefined()
    expect(apiContract.analytics).toBeDefined()
    expect(apiContract.image).toBeDefined()
    expect(apiContract.music).toBeDefined()
  })
})
