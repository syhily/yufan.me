import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { DATABASE_URL } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/helpers/db/schema'

const globalForDb = globalThis as unknown as {
  db: NodePgDatabase<typeof schema> | undefined
}

export const db = globalForDb.db ?? drizzle({ connection: DATABASE_URL, schema })

if (!globalForDb.db) {
  globalForDb.db = db
}
