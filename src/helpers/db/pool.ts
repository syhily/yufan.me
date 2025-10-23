import { DATABASE_URL } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/helpers/db/schema'

export const db = drizzle(DATABASE_URL, { schema })
