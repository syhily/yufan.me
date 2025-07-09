import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  out: '.',
  schema: '../src/helpers/db/schema.ts',
})
