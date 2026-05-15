import { initClient } from '@ts-rest/core'

import { apiContract } from '@/shared/contracts'

/**
 * Typed ts-rest client. Every endpoint described in `apiContract` is
 * available as a strongly-typed async function.
 *
 *   const { body } = await api.admin.users.list({ query: { offset: 0 } })
 *
 * For mutation endpoints use `unwrap()` to turn non-2xx responses into
 * thrown `ApiError`:
 *
 *   await unwrap(api.admin.users.mute({ params: { id }, body: { muted: true } }))
 */
export const api = initClient(apiContract, {
  baseUrl: '/api',
  baseHeaders: {
    'Content-Type': 'application/json',
  },
})
