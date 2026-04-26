// Vitest global setup. Provides the env vars `@/shared/env.server` requires
// at module-load time so tests can transitively import `*.server.ts` modules
// without spinning up Postgres/Redis. The actual values live in
// `tests/_helpers/env.ts` so they can be re-imported piecewise.
import './_helpers/env'
