import { gunzipSync } from 'node:zlib'
import { PGlite } from '@electric-sql/pglite'
import { pgDump } from '@electric-sql/pglite-tools/pg_dump'
import { DATABASE_STORAGE_PATH } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/helpers/db/schema'

const schemaChanges = import.meta.glob('../../../drizzle/*.sql', {
  import: 'default',
  query: '?binary',
  eager: true,
})

const client = await PGlite.create({ dataDir: DATABASE_STORAGE_PATH })

async function databaseMigrations() {
  // Initialize the embedded database with schema evolution.
  await client.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    "id" bigserial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL,
    "execution_time" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)

  for (const schemaChange of Object.entries(schemaChanges).sort(([k1], [k2]) => k1.localeCompare(k2))) {
    const name = schemaChange[0].substring(schemaChange[0].lastIndexOf('/') + 1)
    const content = gunzipSync(schemaChange[1] as Uint8Array).toString('utf-8')

    const { rows } = await client.query('SELECT name FROM schema_migrations WHERE name = $1;', [name])
    if (rows.length > 0) {
      continue
    }
    console.warn(`Applying migration: ${name}`)
    await client.exec(content)
    console.warn(`Applied migration: ${name}`)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [name])
  }

  await client.exec(`SET search_path TO public;`)
}

await databaseMigrations()

export const db = drizzle({
  client,
  schema,
  logger: !import.meta.env.PROD,
})

export async function dumpDatabase(): Promise<string> {
  const pgMem = await client.clone() as PGlite
  const dump = await pgDump({ pg: pgMem })
  return await dump.text()
}

export async function importDatabase(dump: string) {
  await client.exec(`DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;`)
  await client.exec(dump)
  await client.exec(`SET search_path TO public;`)
}
