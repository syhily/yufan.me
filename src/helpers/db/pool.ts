import * as schema from '@/helpers/db/schema';
import {
  POSTGRES_DATABASE,
  POSTGRES_HOST,
  POSTGRES_PASSWORD,
  POSTGRES_PORT,
  POSTGRES_USERNAME,
} from 'astro:env/server';
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
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    user: POSTGRES_USERNAME,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DATABASE,
    keepAlive: true,
  });

// Cache the connection.
globalForDb.conn = conn;

export const db = drizzle(conn, { schema: schema, logger: false });
