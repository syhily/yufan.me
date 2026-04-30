import { eq } from 'drizzle-orm'

import type { Setting } from '@/server/db/types'

import { db } from '@/server/db/pool'
import { setting } from '@/server/db/schema'

const DEFAULT_SCOPE = 'blog'

export async function findSettingByScope(scope: string = DEFAULT_SCOPE): Promise<Setting | null> {
  const rows = await db.select().from(setting).where(eq(setting.scope, scope)).limit(1)
  return rows[0] ?? null
}

export async function upsertSetting(
  data: Record<string, unknown>,
  updatedBy: bigint | null,
  scope: string = DEFAULT_SCOPE,
): Promise<Setting> {
  const now = new Date()
  const result = await db
    .insert(setting)
    .values({
      scope,
      data,
      updatedAt: now,
      updatedBy,
    })
    .onConflictDoUpdate({
      target: setting.scope,
      set: { data, updatedAt: now, updatedBy },
    })
    .returning()
  return result[0]
}
