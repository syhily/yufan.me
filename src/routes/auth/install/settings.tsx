import { useState } from 'react'
import { data, redirect } from 'react-router'

import type { InstallWizardData } from '@/shared/types/install'

import { issueCsrfToken } from '@/server/domains/auth/csrf'
import { seedInstallSettingsWithSession } from '@/server/domains/auth/flows'
import { requireStageTwoSession } from '@/server/domains/settings/install-flow'
import { getSupportedTimeZones } from '@/server/domains/settings/timezones'
import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
import { clearInstallSession, InstallWizardProvider } from '@/ui/admin/auth/install-wizard/InstallWizardContext'
import { WizardShell } from '@/ui/admin/auth/install-wizard/WizardShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'

import type { Route } from './+types/settings'

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireStageTwoSession({ request, context })

  const { token: csrf, setCookie } = await issueCsrfToken()
  return data({ csrf, timeZones: getSupportedTimeZones() }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  const { session, user } = await requireStageTwoSession({ request, context })

  const formData = await request.formData()
  const csrf = (formData.get('csrf') as string | null) ?? ''
  const payloadRaw = (formData.get('payload') as string | null) ?? ''

  let wizardData: InstallWizardData
  try {
    wizardData = JSON.parse(payloadRaw) as InstallWizardData
  } catch {
    return data({ error: '请求格式错误，请刷新页面后重试。' }, { status: 400 })
  }

  const result = await seedInstallSettingsWithSession({
    csrf,
    data: wizardData,
    admin: { id: user!.id, name: user!.name, email: user!.email },
    session,
    request,
  })

  if (!result.ok) {
    return data({ error: result.message }, { headers: result.headers, status: result.status })
  }

  // Clean up client-side session storage on successful install
  clearInstallSession()

  throw redirect(result.data.redirectTo, { headers: result.headers })
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '初始化站点配置' }, bundleFromMatches(matches))
}

export default function SettingsInstallRoute({ actionData, loaderData }: Route.ComponentProps) {
  const [error] = useState(actionData?.error)

  return (
    <InstallWizardProvider>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">初始化站点配置</CardTitle>
          <CardDescription>完成以下步骤来配置你的站点。所有设置可在安装完成后在后台修改。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <WizardShell csrf={loaderData.csrf} timeZones={loaderData.timeZones} />
        </CardContent>
      </Card>
    </InstallWizardProvider>
  )
}
