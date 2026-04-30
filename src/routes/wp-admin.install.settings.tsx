import { data, redirect } from 'react-router'

import { installSettingsSchema } from '@/server/auth-schema'
import { ensureNoSettingsOrRedirect } from '@/server/install/gate'
import { routeMeta } from '@/server/seo/meta'
import {
  getRouteRequestContext,
  issueCsrfToken,
  processAuthFormSubmission,
  seedInstallSettingsWithSession,
} from '@/server/session'
import { getSupportedTimeZones } from '@/server/settings/timezones'
import { SettingsInstallForm } from '@/ui/admin/SettingsInstallForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/admin/shadcn/components/ui/card'

import type { Route } from './+types/wp-admin.install.settings'

const SETTINGS_INSTALL_FIELDS = [
  'token',
  'title',
  'website',
  'authorEmail',
  'assetHost',
  'assetScheme',
  'locale',
  'timeZone',
  'timeFormat',
] as const

const SETTINGS_INSTALL_PATH = '/wp-admin/install/settings.php'

export async function loader({ request, context }: Route.LoaderArgs) {
  // Stage-2 form. The install gate exempts this route, so the loader
  // owns the install-state branching directly through
  // `ensureNoSettingsOrRedirect()`. Possible outcomes:
  //
  //   noAdmin    → 303 → /wp-admin/install.php (must finish stage 1 first)
  //   noSettings → resolve, render the settings form (after auth check below).
  //   installed  → 303 → /wp-login.php
  await ensureNoSettingsOrRedirect()

  // Stage 2 also requires an authenticated admin session: stage 1's
  // success handler auto-logs the new admin in, so the freshly-created
  // user lands here authenticated. If the session was lost (process
  // restart, different browser) bounce through the login page first.
  const { admin } = getRouteRequestContext({ request, context })
  if (!admin) {
    throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(SETTINGS_INSTALL_PATH)}`, { status: 303 })
  }

  const { token, setCookie } = await issueCsrfToken()
  // Pass the IANA timezone list through the loader so the form can
  // render a dropdown (no manual entry → no typos that fail validation
  // server-side). The list is paid for once per process at module load
  // time, so the loader cost is just a cache hit.
  return data({ token, timeZones: getSupportedTimeZones() }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  await ensureNoSettingsOrRedirect()

  const { session, user, admin } = getRouteRequestContext({ request, context })
  if (!admin || !user) {
    throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(SETTINGS_INSTALL_PATH)}`, { status: 303 })
  }

  return processAuthFormSubmission({
    request,
    schema: installSettingsSchema,
    fields: SETTINGS_INSTALL_FIELDS,
    defaultErrorMessage: '请填写完整的站点初始化信息。',
    redirectTo: undefined,
    run: (input) =>
      seedInstallSettingsWithSession({
        ...input,
        admin: { id: user.id, name: user.name },
        session,
        request,
      }),
  })
}

export function meta() {
  return routeMeta({ title: '初始化站点配置' })
}

export default function SettingsInstallRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="tw:text-xl">第 2 步 · 站点初始化</CardTitle>
        <CardDescription>
          填写站点名、CDN 域名与时区等基础信息，向数据库写入第一份配置；其余高级设置可在后台逐项填写。
        </CardDescription>
      </CardHeader>
      <CardContent className="tw:flex tw:flex-col tw:gap-4">
        {actionData?.error && (
          <div
            role="alert"
            aria-live="polite"
            className="tw:bg-destructive/10 tw:text-destructive tw:rounded-md tw:border tw:border-destructive/20 tw:px-3 tw:py-2 tw:text-sm"
          >
            {actionData.error}
          </div>
        )}
        <SettingsInstallForm token={loaderData.token} timeZones={loaderData.timeZones} />
      </CardContent>
    </Card>
  )
}
