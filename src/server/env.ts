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

    // Filesystem path to the MaxMind GeoLite2-City mmdb. Optional —
    // when unset (or unreadable) the analytics ingestion pipeline
    // (`@/server/analytics/geoip`) returns null-only geo fields and
    // every other column on `access_log` still populates. Lives in
    // env (not the `setting` table) because it's a deploy-time file
    // path tied to whatever volume mount ships the binary; rotating
    // it never makes sense to do from an admin UI.
    MAXMIND_DB_PATH: z.string().min(1).optional(),

    // When `true`, admin sessions' visits to the home page and post /
    // page detail pages are written to `access_log` like any other
    // visitor. Default `false` keeps the dashboard owner out of their
    // own visitor metrics (matches the `bumpPageView` exemption on
    // `metric.pv`). Flip to `true` on dev environments where you want
    // to see your own visits land in the table during analytics work.
    ANALYTICS_TRACK_ADMIN: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .default(false),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

// Both the legacy `ZEABUR_MAIL_*` SMTP credentials and the original
// `ASSET_HOST` / `ASSET_SCHEME` CDN env vars used to live here. They
// have all been promoted to the DB-backed admin settings panel
// (`/wp-admin/settings/mail` and `/wp-admin/settings/assets`) so an
// editor can rotate keys, switch buckets, or change the public URL
// without redeploying. The MDX compile pipeline no longer reads any
// image config (the rehype plugin is gone — image metadata is now
// resolved at SSR time against the `image` table), so there is no
// build-time dependency on these values either.
export const {
  ANALYTICS_TRACK_ADMIN,
  DATABASE_URL,
  HOST,
  LOG_LEVEL,
  MAXMIND_DB_PATH,
  PORT,
  REDIS_URL,
  SESSION_SECRET,
} = env
