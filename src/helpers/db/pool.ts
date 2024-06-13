import * as schema from '@/helpers/db/schema';
import { getSecret } from 'astro:env/server';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR update.
 */
const globalForDb = globalThis as unknown as {
  conn: pg.Pool | undefined;
};

const conn =
  globalForDb.conn ??
  new pg.Pool({
    host: getSecret('POSTGRES_HOST'),
    port: getSecret('POSTGRES_PORT'),
    user: getSecret('POSTGRES_USERNAME'),
    password: getSecret('POSTGRES_PASSWORD'),
    database: getSecret('POSTGRES_DATABASE'),
    keepAlive: true,
  });

// Cache the connection.
globalForDb.conn = conn;

export const db = drizzle(conn, { schema: schema, logger: false });
