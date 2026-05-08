import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { drizzle } from 'drizzle-orm/node-postgres'

import { runDatabaseMigrations } from '@/server/db/migrate'
import { DATABASE_URL } from '@/server/env'

// Drizzle 1.0.0-rc.1 narrowed `NodePgDatabase`'s sole generic from a raw
// `{ tableName: PgTable }` map to `AnyRelations` (= `TablesRelationalConfig`),
// and `DrizzlePgConfig` no longer accepts a `schema` field at all — schema-
// bound query helpers now live behind the new `defineRelations()` Relations
// API. Every call site in this codebase uses the core query builder
// (`db.select().from(...)`, `db.insert().values()`, …), which doesn't need
// either, so we drop the schema argument and let the generic default to
// `EmptyRelations`. If a future caller wants `db.query.<table>` style access,
// switch this to `drizzle({ connection, relations })` with a relations module
// and re-introduce the matching generic.
const globalForDb = globalThis as unknown as {
  db: NodePgDatabase | undefined
}

await runDatabaseMigrations()

// Using globalThis to store the database connection so the Vite dev server's
// HMR-driven module reloads don't open a new pool on every edit.
export const db: NodePgDatabase = globalForDb.db ?? drizzle({ connection: DATABASE_URL })

if (!globalForDb.db) {
  globalForDb.db = db
}
