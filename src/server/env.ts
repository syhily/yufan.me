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

    // The CDN host for committed images / music / avatars. Lives as an env
    // var because the MDX compile pipeline (`source.config.ts` →
    // `rehype-image-enhance` → `metadata-store`) and the
    // `sync-image-metadata` CLI both run before any DB connection exists.
    // The runtime (SSR + client) reads the same value out of the DB-backed
    // settings document, so the env var and the admin-edited setting MUST
    // stay in sync at deploy time.
    ASSET_HOST: z.string().min(1),
    ASSET_SCHEME: z.enum(['http', 'https']).default('https'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

// Zeabur mail credentials used to live here. They have been promoted to
// the DB-backed admin settings panel (`/wp-admin/settings/mail`) so an
// editor can pause notifications, rotate the API key, or change the
// `From:` address without redeploying. Bumping `ZEABUR_MAIL_*` in `.env`
// no longer has any effect — set the values from the admin UI instead.
export const { ASSET_HOST, ASSET_SCHEME, DATABASE_URL, HOST, LOG_LEVEL, PORT, REDIS_URL, SESSION_SECRET } = env
