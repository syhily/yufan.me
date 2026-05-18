import { cache } from 'react'
import { redirect } from 'react-router'

import { hydrateBlogSettings } from '@/server/domains/settings/snapshot'
import { hasAdmin } from '@/server/infra/db/operations/user'

// Gate that decides whether the deployment is "installed". The install
// flow is split into two stages so the `setting` row write is gated by
// an admin login (instead of being a one-shot anonymous POST):
//
//                                                 row at scope `blog`.
//
// Three install states result, observable through
// `getInstallState()`:
//
//   noAdmin     — no admin user, regardless of settings row presence.
//                 `/admin/setup`.
//   noSettings  — admin row exists but at least one of the two install
//                 rows (`blog.general` + `blog.assets`) is absent.
//                 303s to `/admin/setup/settings`. The
//                 admin session.
//   installed   — admin AND both install settings rows present.
//
// For any given install state, exactly one of the four `ensure…`
// helpers throws — the others all resolve and render. That keeps the
// "auth pair" (now an "auth trio") collision-free regardless of which
// URL the user hits first.

export type InstallState = 'noAdmin' | 'noSettings' | 'installed'

/**
 * Cheap, snapshot-backed installation check shared by the gate and by
 * the install / login routes.
 *
 * Reads through `hydrateBlogSettings()` so once the gate has run for
 * any request the snapshot is warm and `getInstallState()` costs at
 * most one `hasAdmin()` DB round-trip (which is itself a count over a
 * 1-row partial index in practice).
 *
 * Wrapped in `React.cache` so the `installGateMiddleware` and any
 * downstream loader (`/admin/setup`, `/admin/setup/settings`,
 * `/admin/signin`) that calls `ensure…OrRedirect()` share a single
 * resolution per render pass — see
 * `vercel-react-best-practices/server-cache-react`.
 */
export const getInstallState = cache(async function getInstallState(): Promise<InstallState> {
  // so an admin must exist before the noSettings state is reachable.
  // We always probe `hasAdmin()` first to keep the state machine
  // monotonic.
  if (!(await hasAdmin())) {
    return 'noAdmin'
  }
  const settings = await hydrateBlogSettings()
  if (settings === null) {
    return 'noSettings'
  }
  return 'installed'
})

/**
 * Convenience: `true` iff the deployment has finished BOTH stages.
 * Other code (e.g. `/admin/signin`) only cares about the binary
 * "ready to log in?" question.
 */
export async function isInstalled(): Promise<boolean> {
  return (await getInstallState()) === 'installed'
}

/**
 *
 *   noSettings  → throw 303 → `/admin/setup/settings`.
 *   installed   → throw 303 → `/admin/signin`.
 */
export async function ensureNoAdminOrRedirect(): Promise<null> {
  const state = await getInstallState()
  if (state === 'noAdmin') {
    return null
  }
  if (state === 'noSettings') {
    throw redirect('/admin/install/settings.php', { status: 303 })
  }
  throw redirect('/admin/signin', { status: 303 })
}

/**
 *
 *   noAdmin     → throw 303 → `/admin/setup`.
 *                 that the request is authenticated as admin).
 *   installed   → throw 303 → `/admin/signin`.
 */
export async function ensureNoSettingsOrRedirect(): Promise<null> {
  const state = await getInstallState()
  if (state === 'noSettings') {
    return null
  }
  if (state === 'noAdmin') {
    throw redirect('/admin/install.php', { status: 303 })
  }
  throw redirect('/admin/signin', { status: 303 })
}

/**
 * Loader/action helper for `/admin/signin`.
 *
 *   noAdmin     → throw 303 → `/admin/setup` (nothing to log
 *                 into yet — go create the first admin).
 *   noSettings  → resolve, render the login form (the user can log in,
 *                 immediately afterwards).
 *   installed   → resolve, render the login form.
 */
export async function ensureInstalledOrRedirect(): Promise<null> {
  const state = await getInstallState()
  if (state === 'noAdmin') {
    throw redirect('/admin/install.php', { status: 303 })
  }
  return null
}
