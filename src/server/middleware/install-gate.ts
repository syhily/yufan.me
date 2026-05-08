import type { MiddlewareFunction } from 'react-router'

import { redirect } from 'react-router'

import type { InstallState } from '@/server/install/gate'

import { getInstallState } from '@/server/install/gate'
import { getLogger } from '@/server/logger'
import { hydrateBlogSettings } from '@/server/settings/snapshot'

const log = getLogger('install.gate')

// Endpoints exempted from the install-gate redirect:
//   * `/wp-login.php`                  — the login form. Owns its own
//                                        cross-redirect via
//                                        `ensureInstalledOrRedirect()`.
//                                        cross-redirect via
//                                        `ensureNoAdminOrRedirect()`.
//                                        cross-redirect via
//                                        `ensureNoSettingsOrRedirect()`,
//                                        and additionally requires an
//                                        admin session in its loader.
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
  if (EXEMPT_PATHS.has(pathname)) {
    return true
  }
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export const installGateMiddleware: MiddlewareFunction<Response> = async ({ request }, next) => {
  const url = new URL(request.url)

  // Make sure the in-process settings snapshot is populated before any
  // downstream loader/component reaches for
  // `requireBlogSettingsSection()` / a per-section context hook.
  // `hydrateBlogSettings()` is idempotent
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

  if (isExempt(url.pathname)) {
    return next()
  }

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

  if (state === 'installed') {
    return next()
  }
  if (state === 'noAdmin') {
    return redirect('/wp-admin/install.php', { status: 303 })
  }
  return redirect('/wp-admin/install/settings.php', { status: 303 })
}
