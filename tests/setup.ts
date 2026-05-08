// Vitest global setup. Provides the env vars `@/server/env` requires at
// module-load time so tests can transitively import `*.server.ts` modules
// without spinning up Postgres/Redis. The actual values live in
// `tests/_helpers/env.ts` so they can be re-imported piecewise.
import './_helpers/env'
// Seed the in-process settings snapshot once per worker by writing
// directly to the shared cross-module slot. Importing through
// `@/server/settings/snapshot` would transitively load
// `@/server/infra/db/query/setting` here, and Vitest does not re-mock modules
// imported from a setup file (they're already cached by the time a
// test file's `vi.mock(...)` is hoisted) — so reaching for the slot
// from `@/shared/config/blog` keeps the DB query module unloaded until
// individual test files decide to either mock it or load it. Tests
// that need to clear or replace the snapshot before each `it` should
// call `setBlogSettingsBundleForTests(...)` from
// `@/server/settings/snapshot` themselves.
import { BLOG_SETTINGS_SNAPSHOT_SLOT } from '@/shared/config/blog'

import { TEST_BLOG_SETTINGS_BUNDLE } from './_helpers/blog-settings'

BLOG_SETTINGS_SNAPSHOT_SLOT.write(TEST_BLOG_SETTINGS_BUNDLE)
BLOG_SETTINGS_SNAPSHOT_SLOT.writeHydration(Promise.resolve(TEST_BLOG_SETTINGS_BUNDLE))
