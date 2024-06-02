import * as schema from '@/helpers/db/schema';
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
    host: import.meta.env.POSTGRES_HOST,
    port: Number(import.meta.env.POSTGRES_PORT),
    user: import.meta.env.POSTGRES_USERNAME,
    password: import.meta.env.POSTGRES_PASSWORD,
    database: import.meta.env.POSTGRES_DATABASE,
    keepAlive: true,
  });

// Cache the connection.
globalForDb.conn = conn;

export const db = drizzle(conn, { schema: schema, logger: false });
