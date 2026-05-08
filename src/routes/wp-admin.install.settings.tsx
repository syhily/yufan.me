import { data } from 'react-router'

import { issueCsrfToken } from '@/server/auth/csrf'
import { processAuthFormSubmission, seedInstallSettingsWithSession } from '@/server/auth/flows'
import { installSettingsSchema } from '@/server/auth/schema'
import { bundleFromMatches, routeMeta } from '@/server/present/seo/meta'
import { SETTINGS_INSTALL_FIELDS, requireStageTwoSession } from '@/server/settings/install/install-flow'
import { getSupportedTimeZones } from '@/server/settings/timezones'
import { SettingsInstallForm } from '@/ui/admin/auth/SettingsInstallForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'

import type { Route } from './+types/wp-admin.install.settings'

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireStageTwoSession({ request, context })

  const { token: csrf, setCookie } = await issueCsrfToken()
  // Pass the IANA timezone list through the loader so the form can
  // render a dropdown (no manual entry → no typos that fail validation
  // server-side). The list is paid for once per process at module load
  // time, so the loader cost is just a cache hit.
  return data({ csrf, timeZones: getSupportedTimeZones() }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  const { session, user } = await requireStageTwoSession({ request, context })
  return processAuthFormSubmission({
    request,
    schema: installSettingsSchema,
    fields: SETTINGS_INSTALL_FIELDS,
    defaultErrorMessage: '请填写完整的站点初始化信息。',
    redirectTo: undefined,
    run: (input) =>
      seedInstallSettingsWithSession({
        ...input,
        admin: { id: user!.id, name: user!.name },
        session,
        request,
      }),
  })
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '初始化站点配置' }, bundleFromMatches(matches))
}

export default function SettingsInstallRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">第 2 步 · 站点初始化</CardTitle>
        <CardDescription>
          填写站点名、CDN 域名与时区等基础信息，向数据库写入第一份配置；其余高级设置可在后台逐项填写。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {actionData?.error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {actionData.error}
          </div>
        )}
        <SettingsInstallForm csrf={loaderData.csrf} timeZones={loaderData.timeZones} />
      </CardContent>
    </Card>
  )
}
