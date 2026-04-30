import type { MiddlewareFunction } from 'react-router'

import { redirect } from 'react-router'

import { hasAdmin } from '@/server/db/query/user'
import { getLogger } from '@/server/logger'
import { hydrateBlogSettings } from '@/server/settings/snapshot'

// Gate that decides whether the deployment is "installed". The install
// flow is split into two stages so the `setting` row write is gated by
// an admin login (instead of being a one-shot anonymous POST):
//
//   STAGE 1 — `/wp-admin/install.php`           : create the admin row.
//   STAGE 2 — `/wp-admin/install/settings.php`  : seed the `setting`
//                                                 row at scope `blog`.
//
// Three install states result, observable through
// `getInstallState()`:
//
//   noAdmin     — no admin user, regardless of settings row presence.
//                 Anything other than the stage-1 form 303s to
//                 `/wp-admin/install.php`.
//   noSettings  — admin row exists but the settings row is absent.
//                 Anything other than the stage-2 form (and login)
//                 303s to `/wp-admin/install/settings.php`. The
//                 stage-2 route additionally requires an authenticated
//                 admin session.
//   installed   — admin AND settings present. Normal operation.
//
// Endpoints exempted from the gate's redirect:
//   * `/wp-login.php`                  — the login form. Owns its own
//                                        cross-redirect via
//                                        `ensureInstalledOrRedirect()`.
//   * `/wp-admin/install.php`          — the stage-1 form. Owns its own
//                                        cross-redirect via
//                                        `ensureNoAdminOrRedirect()`.
//   * `/wp-admin/install/settings.php` — the stage-2 form. Owns its own
//                                        cross-redirect via
//                                        `ensureNoSettingsOrRedirect()`,
//                                        and additionally requires an
//                                        admin session in its loader.
//
// For any given install state, exactly one of the four `ensure…`
// helpers throws — the others all resolve and render. That keeps the
// "auth pair" (now an "auth trio") collision-free regardless of which
// URL the user hits first.

const log = getLogger('install.gate')

export type InstallState = 'noAdmin' | 'noSettings' | 'installed'

/**
 * Cheap, snapshot-backed installation check shared by the gate and by
 * the install / login routes.
 *
 * Reads through `hydrateBlogSettings()` so once the gate has run for
 * any request the snapshot is warm and `getInstallState()` costs at
 * most one `hasAdmin()` DB round-trip (which is itself a count over a
 * 1-row partial index in practice).
 */
export async function getInstallState(): Promise<InstallState> {
  // Order matters: stage 1 (admin creation) gates stage 2 (settings),
  // so an admin must exist before the noSettings state is reachable.
  // We always probe `hasAdmin()` first to keep the state machine
  // monotonic.
  if (!(await hasAdmin())) return 'noAdmin'
  const settings = await hydrateBlogSettings()
  if (settings === null) return 'noSettings'
  return 'installed'
}

/**
 * Convenience: `true` iff the deployment has finished BOTH stages.
 * Other code (e.g. `wp-login.php`) only cares about the binary
 * "ready to log in?" question.
 */
export async function isInstalled(): Promise<boolean> {
  return (await getInstallState()) === 'installed'
}

/**
 * Loader/action helper for `/wp-admin/install.php` (stage 1).
 *
 *   noAdmin     → resolve, render the stage-1 form.
 *   noSettings  → throw 303 → `/wp-admin/install/settings.php`.
 *   installed   → throw 303 → `/wp-login.php`.
 */
export async function ensureNoAdminOrRedirect(): Promise<null> {
  const state = await getInstallState()
  if (state === 'noAdmin') return null
  if (state === 'noSettings') {
    throw redirect('/wp-admin/install/settings.php', { status: 303 })
  }
  throw redirect('/wp-login.php', { status: 303 })
}

/**
 * Loader/action helper for `/wp-admin/install/settings.php` (stage 2).
 *
 *   noAdmin     → throw 303 → `/wp-admin/install.php`.
 *   noSettings  → resolve, render the stage-2 form (route also checks
 *                 that the request is authenticated as admin).
 *   installed   → throw 303 → `/wp-login.php`.
 */
export async function ensureNoSettingsOrRedirect(): Promise<null> {
  const state = await getInstallState()
  if (state === 'noSettings') return null
  if (state === 'noAdmin') {
    throw redirect('/wp-admin/install.php', { status: 303 })
  }
  throw redirect('/wp-login.php', { status: 303 })
}

/**
 * Loader/action helper for `/wp-login.php`.
 *
 *   noAdmin     → throw 303 → `/wp-admin/install.php` (nothing to log
 *                 into yet — go create the first admin).
 *   noSettings  → resolve, render the login form (the user can log in,
 *                 the wp-admin redirect chain will hop them to stage 2
 *                 immediately afterwards).
 *   installed   → resolve, render the login form.
 */
export async function ensureInstalledOrRedirect(): Promise<null> {
  const state = await getInstallState()
  if (state === 'noAdmin') {
    throw redirect('/wp-admin/install.php', { status: 303 })
  }
  return null
}

const EXEMPT_PATHS = new Set(['/wp-login.php', '/wp-admin/install.php', '/wp-admin/install/settings.php'])

const EXEMPT_PATH_PREFIXES = [
  '/assets/',
  '/build/',
  '/fonts/',
  '/images/',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  // React Router internals — the framework requests `/__manifest` and
  // similar URLs as part of its hydration / SPA navigation flow.
  '/__manifest',
]

function isExempt(pathname: string): boolean {
  if (EXEMPT_PATHS.has(pathname)) return true
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export const installGateMiddleware: MiddlewareFunction<Response> = async ({ request }, next) => {
  const url = new URL(request.url)

  // Make sure the in-process settings snapshot is populated before any
  // downstream loader/component reaches for `requireBlogConfig()` /
  // `useRequiredBlogConfig()`. `hydrateBlogSettings()` is idempotent
  // and concurrent callers share the same in-flight promise, so this
  // adds at most one DB round-trip on the first request after server
  // start. We hydrate even for exempt requests so the install loaders'
  // own `getInstallState()` calls hit the warm cache.
  try {
    await hydrateBlogSettings()
  } catch (error) {
    log.error('Install gate failed to hydrate settings; letting request through', { error })
    return next()
  }

  if (isExempt(url.pathname)) return next()

  let state: InstallState
  try {
    state = await getInstallState()
  } catch (error) {
    // If the DB is unreachable we cannot tell installed from
    // uninstalled; let the request through so the route surfaces the
    // underlying 5xx instead of looping in a redirect.
    log.error('Install gate failed to determine install state; letting request through', { error })
    return next()
  }

  if (state === 'installed') return next()
  if (state === 'noAdmin') return redirect('/wp-admin/install.php', { status: 303 })
  return redirect('/wp-admin/install/settings.php', { status: 303 })
}
