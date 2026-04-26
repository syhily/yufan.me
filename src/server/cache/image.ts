import type { Buffer } from 'node:buffer'

import { createInflight } from '@/server/cache/inflight'
import { storage } from '@/server/cache/storage'

// Coalesce concurrent loaders for the same key — without this, a cold OG /
// calendar / avatar image getting hit by 50 simultaneous requests right after
// a deploy would render 50 times in parallel before the first write to
// `storage` is observable to the rest.
const bufferInflight = createInflight<Buffer>()

export async function loadBuffer(key: string, loader: () => Promise<Buffer>, ttl: number): Promise<Buffer> {
  // Single Redis round-trip on the hot path: `getItemRaw` returns the value
  // when present and `null` otherwise, replacing the previous
  // `hasItem` + `getItemRaw` pair (and the non-null assertion that came with
  // it). The `bufferInflight` below still dedupes concurrent cold loads so
  // a deploy spike doesn't fan out into N parallel renders.
  if (import.meta.env.PROD) {
    const cached = await storage.getItemRaw<Buffer>(key)
    if (cached !== null) return cached
  }
  return bufferInflight(key, async () => {
    const buffer = await loader()
    await storage.setItemRaw(key, buffer, { ttl })
    return buffer
  })
}
