import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/helpers/db/schema.ts',
  out: './src/helpers/db',
  dialect: 'postgresql',
  dbCredentials: {
    // Given this is only used in local development, I just use the force casing.
    host: process.env.POSTGRES_HOST as string,
    port: Number(process.env.POSTGRES_PORT as string),
    user: process.env.POSTGRES_USERNAME as string,
    password: process.env.POSTGRES_PASSWORD as string,
    database: process.env.POSTGRES_DATABASE as string,
  },
  verbose: true,
  strict: true,
});
