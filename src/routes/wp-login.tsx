import { data, redirect } from 'react-router'

import { signInSchema } from '@/server/auth/schema'
import { ensureInstalledOrRedirect } from '@/server/install/gate'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import {
  issueCsrfToken,
  signInWithSession,
  processAuthFormSubmission,
  getRouteRequestContext,
  destroySession,
} from '@/server/session'
import { safeRedirectPath } from '@/shared/safe-url'
import { AdminCredentialsForm } from '@/ui/admin/auth/AdminCredentialsForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'

import type { Route } from './+types/wp-login'

export async function loader({ request, context }: Route.LoaderArgs) {
  // The install gate exempts this route so login owns the
  // "is the deployment installed?" branch directly. With the two-stage
  // install split:
  //
  //   noAdmin    → 303 → /wp-admin/install.php (nothing to log in to).
  //   noSettings → render the login form (the user will be auto-bounced
  //   installed  → render the login form.
  //
  // Only one of the four `ensure…OrRedirect()` helpers across the
  // install/login routes ever throws for a given install state, so the
  // auth trio (install / settings / login) cannot loop.
  await ensureInstalledOrRedirect()

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
  // Refuse login POSTs on a noAdmin deployment for the same reason the
  // loader bounces GETs: there is no admin row to authenticate against.
  // noSettings is allowed through (the admin can log in and finish the
  await ensureInstalledOrRedirect()

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

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '用户登陆' }, bundleFromMatches(matches))
}

export default function LoginRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">用户登陆</CardTitle>
        <CardDescription>使用管理员邮箱与密码登陆后台。</CardDescription>
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
        <AdminCredentialsForm token={loaderData.token} />
      </CardContent>
    </Card>
  )
}
