import { createEnv } from '@t3-oss/env-core'
import process from 'node:process'
import { z } from 'zod'

export const env = createEnv({
  server: {
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4321),

    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    SESSION_SECRET: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

// Zeabur mail credentials used to live here. They have been promoted to
// the DB-backed admin settings panel (`/wp-admin/settings/mail`) so an
// editor can pause notifications, rotate the API key, or change the
// `From:` address without redeploying. Bumping `ZEABUR_MAIL_*` in `.env`
// no longer has any effect — set the values from the admin UI instead.
export const { DATABASE_URL, HOST, LOG_LEVEL, PORT, REDIS_URL, SESSION_SECRET } = env
