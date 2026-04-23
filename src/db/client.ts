import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { DATABASE_URL } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/node-postgres'

import { comment, like, page, user, verification } from '@/db/schema'

const schema = { comment, like, page, user, verification }
type Schema = typeof schema

// Using globalThis to store the database connection for avoiding multiple connections in Vite dev server.
const globalForDb = globalThis as unknown as {
  db: NodePgDatabase<Schema> | undefined
}

export const db = globalForDb.db ?? drizzle({ connection: DATABASE_URL, schema })

if (!globalForDb.db) {
  globalForDb.db = db
}
