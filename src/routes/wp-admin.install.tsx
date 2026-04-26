import { data, redirect } from 'react-router'

import { signUpAdminSchema } from '@/server/auth-schema'
import { hasAdmin } from '@/server/db/query/user'
import { routeMeta } from '@/server/seo/meta'
import {
  issueCsrfToken,
  signUpInitialAdminWithSession,
  processAuthFormSubmission,
  getRouteRequestContext,
} from '@/server/session'
import { AdminCredentialsForm } from '@/ui/admin/AdminCredentialsForm'

import type { Route } from './+types/wp-admin.install'

export async function loader({ request, context }: Route.LoaderArgs) {
  if (await hasAdmin()) {
    throw redirect('/wp-login.php')
  }

  // Pull the request context so we trip session middleware exactly once even
  // though we no longer write the CSRF token through the session.
  getRouteRequestContext({ request, context })
  const { token, setCookie } = await issueCsrfToken()
  return data({ token }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  if (await hasAdmin()) {
    throw redirect('/wp-login.php')
  }

  const { session } = getRouteRequestContext({ request, context })
  return processAuthFormSubmission({
    request,
    schema: signUpAdminSchema,
    fields: ['name', 'email', 'password', 'token'] as const,
    defaultErrorMessage: '请填写完整的管理员信息。',
    redirectTo: undefined,
    run: (input) => signUpInitialAdminWithSession({ ...input, session, request }),
  })
}

export function meta() {
  return routeMeta({ title: '注册管理员账号' })
}

export default function AdminInstallRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <div className="container">
      <h1 className="mb-4">注册管理员账号</h1>
      {actionData?.error && <div className="alert alert-danger">{actionData.error}</div>}
      <AdminCredentialsForm mode="install" token={loaderData.token} />
    </div>
  )
}
