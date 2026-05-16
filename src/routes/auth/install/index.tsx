import { data } from 'react-router'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { issueCsrfToken } from '@/server/domains/auth/csrf'
import { processAuthFormSubmission, signUpInitialAdminWithSession } from '@/server/domains/auth/flows'
import { signUpAdminSchema } from '@/server/domains/auth/schema'
import { ensureNoAdminOrRedirect } from '@/server/domains/settings/install-gate'
import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
import { AdminInstallForm } from '@/ui/admin/auth/AdminInstallForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'

import type { Route } from './+types/index'

const ADMIN_INSTALL_FIELDS = ['name', 'email', 'password', 'csrf'] as const

export async function loader({ request, context }: Route.LoaderArgs) {
  // owns the install-state branching directly through
  // `ensureNoAdminOrRedirect()`. Possible outcomes:
  //
  //   noAdmin    → render the admin-credentials form.
  //   noSettings → 303 → /wp-admin/install/settings.php
  //   installed  → 303 → /wp-login.php
  await ensureNoAdminOrRedirect()

  // Pull the request context so we trip session middleware exactly once
  // even though we no longer write the CSRF token through the session.
  getRouteRequestContext({ request, context })
  const { token: csrf, setCookie } = await issueCsrfToken()
  return data({ csrf }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  // Same gate as the loader. A POST that races a concurrent install
  // would still be caught by `signUpInitialAdminWithSession`'s own
  // `hasAdmin()` check (returns 409), so the redirect here is a UX
  // courtesy, not a security boundary.
  await ensureNoAdminOrRedirect()

  const { session, clientAddress } = getRouteRequestContext({ request, context })
  return processAuthFormSubmission({
    request,
    schema: signUpAdminSchema,
    fields: ADMIN_INSTALL_FIELDS,
    defaultErrorMessage: '请填写完整的管理员账号信息。',
    redirectTo: undefined,
    run: (input) => signUpInitialAdminWithSession({ ...input, session, request, clientAddress }),
  })
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '初始化管理员' }, bundleFromMatches(matches))
}

export default function AdminInstallRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">第 1 步 · 创建管理员</CardTitle>
        <CardDescription>首次部署需要先创建管理员账号。提交后将自动登录，并跳转到第 2 步配置站点信息。</CardDescription>
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
        <AdminInstallForm csrf={loaderData.csrf} />
      </CardContent>
    </Card>
  )
}
