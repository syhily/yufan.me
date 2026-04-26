import { data, redirect } from 'react-router'

import { signInSchema } from '@/server/auth-schema'
import { routeMeta } from '@/server/seo/meta'
import {
  issueCsrfToken,
  signInWithSession,
  processAuthFormSubmission,
  getRouteRequestContext,
  destroySession,
} from '@/server/session'
import { safeRedirectPath } from '@/shared/safe-url'
import { AdminCredentialsForm } from '@/ui/admin/AdminCredentialsForm'

import type { Route } from './+types/wp-login'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { session, user, url } = getRouteRequestContext({ request, context })
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/', url.origin)
  const action = url.searchParams.get('action')

  if (action === 'logout') {
    throw redirect(redirectTo, {
      headers: { 'Set-Cookie': await destroySession(session) },
    })
  }

  if (user) {
    throw redirect(redirectTo)
  }

  const { token, setCookie } = await issueCsrfToken()
  return data({ redirectTo, token }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  const { session, clientAddress, url } = getRouteRequestContext({ request, context })
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/wp-admin', url.origin)
  return processAuthFormSubmission({
    request,
    schema: signInSchema,
    fields: ['email', 'password', 'token'] as const,
    defaultErrorMessage: '请填写正确的邮箱和密码。',
    redirectTo,
    run: (input) => signInWithSession({ ...input, session, request, clientAddress, redirectTo }),
  })
}

export function meta() {
  return routeMeta({ title: '用户登陆' })
}

export default function LoginRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <div className="container">
      <h1 className="mb-4">用户登陆</h1>
      {actionData?.error && <div className="alert alert-danger">{actionData.error}</div>}
      <AdminCredentialsForm mode="login" token={loaderData.token} />
    </div>
  )
}
