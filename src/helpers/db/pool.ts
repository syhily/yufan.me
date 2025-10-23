import { DATABASE_URL } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/helpers/db/schema'

// Pool sizing strategy for target QPS
const TARGET_QPS = 1000
const QPS_PER_CONN = 50
const MAX_POOL = 200
const MIN_POOL = 2
const calculatedMax = Math.max(MIN_POOL, Math.min(Math.ceil(TARGET_QPS / Math.max(1, QPS_PER_CONN)), MAX_POOL))

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: calculatedMax,
  min: MIN_POOL,
  maxUses: 7500,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err)
})

pool.on('connect', (client) => {
  const statementTimeout = 5_000
  client.query(`SET statement_timeout = ${statementTimeout}`).catch(() => {})
})

export const db = drizzle(pool, { schema })
