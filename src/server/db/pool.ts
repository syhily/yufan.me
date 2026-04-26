import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { drizzle } from 'drizzle-orm/node-postgres'

import { runDatabaseMigrations } from '@/server/db/migrate'
import { comment, like, page, user, verification } from '@/server/db/schema'
import { DATABASE_URL } from '@/server/env'

const schema = { comment, like, page, user, verification }
type Schema = typeof schema

// Using globalThis to store the database connection for avoiding multiple connections in Vite dev server.
const globalForDb = globalThis as unknown as {
  db: NodePgDatabase<Schema> | undefined
}

await runDatabaseMigrations()

export const db = globalForDb.db ?? drizzle({ connection: DATABASE_URL, schema })

if (!globalForDb.db) {
  globalForDb.db = db
}
