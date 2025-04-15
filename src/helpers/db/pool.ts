import schema from '@/helpers/db/schema';
import {
  POSTGRES_DATABASE,
  POSTGRES_HOST,
  POSTGRES_PASSWORD,
  POSTGRES_PORT,
  POSTGRES_USERNAME,
} from 'astro:env/server';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export const db = drizzle({
  client: new pg.Pool({
    user: POSTGRES_USERNAME,
    password: POSTGRES_PASSWORD,
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    database: POSTGRES_DATABASE,
    keepAlive: true,
    max: 10,
    allowExitOnIdle: true,
  }),
  schema: schema,
  logger: false,
});
