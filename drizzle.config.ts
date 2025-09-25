import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/helpers/db/schema.ts',
  out: './drizzle',
  driver: 'pglite',
})
