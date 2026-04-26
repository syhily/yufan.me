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

    ZEABUR_MAIL_HOST: z.string().min(1).optional(),
    ZEABUR_MAIL_API_KEY: z.string().min(1).optional(),
    ZEABUR_MAIL_SENDER: z.email().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

export const {
  DATABASE_URL,
  HOST,
  LOG_LEVEL,
  PORT,
  REDIS_URL,
  SESSION_SECRET,
  ZEABUR_MAIL_API_KEY,
  ZEABUR_MAIL_HOST,
  ZEABUR_MAIL_SENDER,
} = env
