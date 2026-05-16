import { redirect } from 'react-router'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { ensureNoSettingsOrRedirect } from '@/server/domains/settings/install-gate'

// `src/routes/wp-admin.install.settings.tsx` per the route-orchestration
// rule. The route module is now reduced to: parse args → call helpers →
// render. Anything that needs a `redirect()` or DB lookup lives here.

/** Field allowlist for the stage-2 install form. The shape mirrors
 *  `installSettingsSchema` and is consumed by
 *  `processAuthFormSubmission` to project the FormData into the
 *  validated input. */
export const SETTINGS_INSTALL_FIELDS = [
  'csrf',
  'title',
  'website',
  'authorEmail',
  'assetHost',
  'assetScheme',
  'locale',
  'timeZone',
  'timeFormat',
] as const

/** Canonical URL for stage 2. Used both to build the
 *  `/wp-login.php?redirect_to=…` bounce target and for `meta()` `og:url`. */
export const SETTINGS_INSTALL_PATH = '/wp-admin/install/settings.php'

/** Built once so callers don't repeat the encodeURIComponent dance. */
export const SETTINGS_INSTALL_LOGIN_BOUNCE = `/wp-login.php?redirect_to=${encodeURIComponent(SETTINGS_INSTALL_PATH)}`

interface RouteRequest {
  request: Request
  context: unknown
}

/** Stage-2 guard. Combines the install-state gate with the admin-session
 *  check so the route loader/action only has one call. Returns the
 *  hydrated request context (admin/user/session) so the action can
 *  thread it into `seedInstallSettingsWithSession()` without re-parsing
 *  cookies. Throws a 303 redirect when either guard fails. */
export async function requireStageTwoSession(args: RouteRequest) {
  await ensureNoSettingsOrRedirect()

  // freshly-created user lands here authenticated. If the session was
  // lost (process restart, different browser) bounce through the login
  // page first and return after auth.
  const ctx = getRouteRequestContext(args as { request: Request; context: never })
  if (ctx.role !== 'admin' || !ctx.user) {
    throw redirect(SETTINGS_INSTALL_LOGIN_BOUNCE, { status: 303 })
  }
  return ctx
}
