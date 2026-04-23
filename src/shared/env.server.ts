import { createEnv } from '@t3-oss/env-core'
import process from 'node:process'
import { z } from 'zod'

import config from '@/blog.config'

export const env = createEnv({
  server: {
    SITE: z.url().default(config.website),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4321),

    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    SESSION_SECRET: z.string().min(1),

    ZEABUR_MAIL_HOST: z.string().min(1).optional(),
    ZEABUR_MAIL_API_KEY: z.string().min(1).optional(),
    ZEABUR_MAIL_SENDER: z.email().optional(),

    UPLOAD_STATIC_FILES: z.enum(['true', 'false']).default('false'),
    ASSET_BASE_URL: z.url().optional(),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().min(1).default('auto'),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_PREFIX: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

export const {
  ASSET_BASE_URL,
  DATABASE_URL,
  HOST,
  LOG_LEVEL,
  PORT,
  REDIS_URL,
  S3_ACCESS_KEY,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_PREFIX,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  SESSION_SECRET,
  SITE,
  UPLOAD_STATIC_FILES,
  ZEABUR_MAIL_API_KEY,
  ZEABUR_MAIL_HOST,
  ZEABUR_MAIL_SENDER,
} = env
