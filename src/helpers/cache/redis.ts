import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from 'astro:env/server'
import { createStorage } from 'unstorage'

import redisDriver from 'unstorage/drivers/redis'

const storage = createStorage({
  driver: redisDriver({
    base: 'unstorage',
    host: REDIS_HOST,
    tls: false as any,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    ttl: 60 * 60 * 24,
  }),
})

const LIMIT_TTL = 60 * 30

export async function exceedLimit(ip: string) {
  const key = `astro-retry-limit-${ip}`
  const times = await storage.getItem<number>(key)
  return times !== null && times > 5
}

export async function incrLimit(ip: string) {
  const key = `astro-retry-limit-${ip}`
  const times = await storage.getItem<number>(key)

  if (times === null) {
    storage.setItem(key, 1, { ttl: LIMIT_TTL /* seconds */ })
  }
  else {
    storage.setItem(key, times + 1, { ttl: LIMIT_TTL /* seconds */ })
  }
}
