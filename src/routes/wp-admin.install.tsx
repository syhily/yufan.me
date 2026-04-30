import { data } from 'react-router'

import { signUpAdminSchema } from '@/server/auth-schema'
import { ensureNoAdminOrRedirect } from '@/server/install/gate'
import { routeMeta } from '@/server/seo/meta'
import {
  getRouteRequestContext,
  issueCsrfToken,
  processAuthFormSubmission,
  signUpInitialAdminWithSession,
} from '@/server/session'
import { AdminInstallForm } from '@/ui/admin/AdminInstallForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/admin/shadcn/components/ui/card'

import type { Route } from './+types/wp-admin.install'

const ADMIN_INSTALL_FIELDS = ['name', 'email', 'password', 'token'] as const

export async function loader({ request, context }: Route.LoaderArgs) {
  // Stage-1 form. The install gate exempts this route, so the loader
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
  const { token, setCookie } = await issueCsrfToken()
  return data({ token }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  // Same gate as the loader. A POST that races a concurrent install
  // would still be caught by `signUpInitialAdminWithSession`'s own
  // `hasAdmin()` check (returns 409), so the redirect here is a UX
  // courtesy, not a security boundary.
  await ensureNoAdminOrRedirect()

  const { session } = getRouteRequestContext({ request, context })
  return processAuthFormSubmission({
    request,
    schema: signUpAdminSchema,
    fields: ADMIN_INSTALL_FIELDS,
    defaultErrorMessage: '请填写完整的管理员账号信息。',
    redirectTo: undefined,
    run: (input) => signUpInitialAdminWithSession({ ...input, session, request }),
  })
}

export function meta() {
  return routeMeta({ title: '初始化管理员' })
}

export default function AdminInstallRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="tw:text-xl">第 1 步 · 创建管理员</CardTitle>
        <CardDescription>首次部署需要先创建管理员账号。提交后将自动登录，并跳转到第 2 步配置站点信息。</CardDescription>
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
        <AdminInstallForm token={loaderData.token} />
      </CardContent>
    </Card>
  )
}
