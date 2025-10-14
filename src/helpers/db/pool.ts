import { DATABASE_URL } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from '@/helpers/db/schema'

export const db = drizzle({
  connection: DATABASE_URL,
  ws,
  schema,
})
