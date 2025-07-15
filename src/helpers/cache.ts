import type { Buffer } from 'node:buffer'
import { createStorage } from 'unstorage'

import memoryDriver from 'unstorage/drivers/memory'

const storage = createStorage({
  driver: memoryDriver(),
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

export interface Avatar {
  status: AvatarStatus
  buffer: Buffer | null
}

export enum AvatarStatus {
  HAVE_AVATAR = 0,
  NO_AVATAR = 1,
}

export async function loadAvatar(email: string): Promise<Avatar | null> {
  const status = await storage.getItem<AvatarStatus>(`avatar-status-${email}`)
  if (status === null) {
    return null
  }
  if (status === AvatarStatus.NO_AVATAR) {
    return { status, buffer: null }
  }
  const buffer = await storage.getItemRaw(`avatar-${email}`)
  if (buffer === null) {
    return null
  }
  return { status, buffer }
}

export async function cacheAvatar(args: { email: string, buffer: Buffer, status: AvatarStatus.HAVE_AVATAR } | { email: string, status: AvatarStatus.NO_AVATAR }) {
  const { email, status } = args
  await storage.setItem<AvatarStatus>(`avatar-status-${email}`, status, { ttl: 60 * 60 * 24 })
  if (status === AvatarStatus.HAVE_AVATAR) {
    await storage.setItemRaw(`avatar-${email}`, args.buffer, { ttl: 25 * 60 * 60 })
  }
}

export async function loadBuffer(key: string): Promise<Buffer | null> {
  return await storage.getItemRaw<Buffer>(key)
}

export async function cacheBuffer(key: string, buffer: Buffer, ttl: number) {
  await storage.setItemRaw(key, buffer, { ttl })
}
