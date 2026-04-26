import type { Cluster, Redis } from 'ioredis'

import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

import { REDIS_URL } from '@/server/env'

export const storage = createStorage({
  driver: redisDriver({ url: REDIS_URL }),
})

// Reach into the unstorage redis driver to expose the underlying ioredis
// client for callers that need atomic operations (INCR, EXPIRE, MULTI, …)
// that the unstorage `Storage` interface intentionally doesn't expose.
//
// Used by `rate-limit.server.ts` to avoid a read-modify-write race on the
// counter. Keep this lazily-resolved so we don't force-connect on import.
export function redisInstance(): Redis | Cluster {
  const driver = storage.getMount('').driver
  if (typeof driver.getInstance !== 'function') {
    throw new Error('redisInstance: driver does not expose getInstance()')
  }
  return driver.getInstance() as Redis | Cluster
}
