import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from 'astro:env/server'
import { createStorage } from 'unstorage'

import redisDriver from 'unstorage/drivers/redis'

const _storage = createStorage({
  driver: redisDriver({
    base: 'unstorage',
    host: REDIS_HOST,
    tls: false as any,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    ttl: 60 * 60 * 24,
    path: 'astro-caches',
  }),
})
