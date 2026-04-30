// Centralised env defaults used by every test that pulls in `.server.ts`
// modules (which read `@/shared/env.server` at module-load time). Kept in
// sync with `tests/setup.ts` so individual tests can re-import it cheaply.
export const TEST_ENV = {
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'vitest-session-secret',
  // The build-time MDX pipeline + the `sync-image-metadata` CLI read
  // these directly from `process.env`. They are also surfaced through
  // `@/server/env` for the runtime so the t3-env schema rejects an
  // empty deploy.
  ASSET_HOST: 'cat.yufan.me',
  ASSET_SCHEME: 'https',
} as const

export function ensureTestEnv(): void {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] ??= value
  }
}

ensureTestEnv()
