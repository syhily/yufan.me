import type { APIRoute } from 'astro'
import { formatLocalDate } from '@/helpers/content/formatter'
import defer * as pool from '@/helpers/db/pool'

export const GET: APIRoute = async () => {
  const dump = await pool.dumpDatabase()
  return new Response(dump, {
    headers: {
      'Content-Type': 'application/sql',
      'Content-Disposition': `attachment; filename="backup-${formatLocalDate(new Date(), 'yyyy-LL-dd-HH-mm')}.sql"`,
    },
  })
}
