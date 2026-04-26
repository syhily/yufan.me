// Centralised env defaults used by every test that pulls in `.server.ts`
// modules (which read `@/shared/env.server` at module-load time). Kept in
// sync with `tests/setup.ts` so individual tests can re-import it cheaply.
export const TEST_ENV = {
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'vitest-session-secret',
} as const

export function ensureTestEnv(): void {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    process.env[key] ??= value
  }
}

ensureTestEnv()
