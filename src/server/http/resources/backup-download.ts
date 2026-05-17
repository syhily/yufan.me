import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

import { getBackupBuffer } from '@/server/domains/backup/service'
import { requireRoleMw } from '@/server/http/middlewares/hono-rbac'

export const backupDownloadRouter = new Hono<Env>().get(
  '/api/admin/backup/download/:key{.+}',
  requireRoleMw('admin'),
  async (c) => {
    const key = c.req.param('key')
    const buffer = await getBackupBuffer(key)
    const fileName = key.split('/').pop() ?? 'backup.sql.gz'
    c.header('Content-Type', 'application/gzip')
    c.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return c.body(new Uint8Array(buffer))
  },
)
