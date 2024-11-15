/* eslint-disable antfu/no-top-level-await */
import { gunzipSync } from 'node:zlib'
import { PGlite } from '@electric-sql/pglite'
import { DATABASE_STORAGE_PATH } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/helpers/db/schema'
import options from '@/options'

const schemaChanges = import.meta.glob('../../../drizzle/*.sql', {
  import: 'default',
  query: '?binary',
  eager: true,
})

const client = new PGlite(DATABASE_STORAGE_PATH)

// Initialize the embedded database with schema evolution.
await client.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  "id" bigserial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "execution_time" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);`)

for (const schemaChange of Object.entries(schemaChanges).sort(([k1], [k2]) => k1.localeCompare(k2))) {
  const name = schemaChange[0]
  const content = gunzipSync(schemaChange[1] as Uint8Array).toString('utf-8')

  console.error(`Applying migration: ${name}`)
  await client.exec(content)
  console.error(`Applied migration: ${name}`)
  await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [name])
}

export const db = drizzle({
  client,
  schema,
  logger: !options.isProd(),
})
