import type { NewAuditLog } from '@/server/infra/db/schema'

import { db } from '@/server/infra/db/pool'
import { auditLog } from '@/server/infra/db/schema'

/**
 * Fire-and-forget audit log writer.  Never awaits in the hot path —
 * errors are logged but do not fail the caller's transaction.
 */
export function logAudit(entry: Omit<NewAuditLog, 'id' | 'createdAt'>): void {
  void db
    .insert(auditLog)
    .values({
      ...entry,
      createdAt: new Date(),
    })
    .catch((err: unknown) => {
      console.error('[audit] failed to write audit log:', err)
    })
}
