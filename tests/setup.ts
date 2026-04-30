// Vitest global setup. Provides the env vars `@/server/env` requires at
// module-load time so tests can transitively import `*.server.ts` modules
// without spinning up Postgres/Redis. The actual values live in
// `tests/_helpers/env.ts` so they can be re-imported piecewise.
import './_helpers/env'
// Seed the in-process settings snapshot once per worker. After the
// static-config refactor `requireBlogConfig()` throws when the snapshot
// is empty, so any test that imports a server module which formats a
// date / builds an image URL / reaches into `config.settings.*` would
// crash before its own setup ran. We seed via the shared-module setter
// directly (rather than going through `@/server/settings/snapshot`) so
// individual tests can still `vi.mock('@/server/db/query/setting', …)`
// without the snapshot module having captured a stale reference to the
// real DB query at setup time. The slot now holds a
// `BlogSettingsBundle` (one bucket per section); the test fixture
// keeps spelling itself in the legacy `BlogSettings` shape and we
// decompose it on the way in.
import { blogSettingsToBundle } from '@/shared/blog-config'
import { _setBlogSettingsHydration, _setBlogSettingsSnapshot } from '@/shared/blog-config-snapshot'

import { TEST_BLOG_SETTINGS } from './_helpers/blog-settings'

const TEST_BLOG_SETTINGS_BUNDLE = blogSettingsToBundle(TEST_BLOG_SETTINGS)

_setBlogSettingsSnapshot(TEST_BLOG_SETTINGS_BUNDLE)
_setBlogSettingsHydration(Promise.resolve(TEST_BLOG_SETTINGS_BUNDLE))
