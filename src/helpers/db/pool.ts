import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { DATABASE_URL } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/helpers/db/schema'

const globalForDb = globalThis as unknown as {
  db: NodePgDatabase<typeof schema> | undefined
}

const pool = new Pool({
  connectionString: DATABASE_URL,
})

export const db = globalForDb.db ?? drizzle({ client: pool, schema })

if (!globalForDb.db) {
  globalForDb.db = db
}
